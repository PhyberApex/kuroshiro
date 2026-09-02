import type { JsonObject } from '../../utils/json.js'
import type { PluginKind } from '../entities/plugin.entity.js'
import { Buffer } from 'node:buffer'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import AdmZip from 'adm-zip'
import * as yaml from 'js-yaml'
import { isPlainObject } from '../../utils/json.js'
import { resolveAppPath } from '../../utils/pathHelper.js'

function parseYamlObject<T>(content: string, invalidMessage: string): T {
  const parsed: unknown = yaml.load(content)
  if (!isPlainObject(parsed)) {
    throw new BadRequestException(invalidMessage)
  }
  return parsed as T
}

export type TemplateLayout = 'full' | 'half_horizontal' | 'half_vertical' | 'quadrant'

// Checked in order against the template filename; the first substring match wins.
const TEMPLATE_LAYOUTS: Array<[substring: string, layout: TemplateLayout]> = [
  ['half_horizontal', 'half_horizontal'],
  ['half_vertical', 'half_vertical'],
  ['quadrant', 'quadrant'],
]

export function layoutFromTemplateFilename(filename: string): TemplateLayout {
  const match = TEMPLATE_LAYOUTS.find(([substring]) => filename.includes(substring))
  return match ? match[1] : 'full'
}

const KNOWN_TEMPLATE_LAYOUT_NAMES: string[] = ['full', ...TEMPLATE_LAYOUTS.map(([substring]) => substring)]

interface TerminusManifest {
  name?: string
  description?: string
  custom_fields?: CustomField[]
  variables?: JsonObject
}

interface CustomField {
  keyname: string
  field_type: string
  name: string
  description?: string
  default_value?: string
  optional?: boolean
}

interface DataSourceEntry {
  name?: string
  mode?: string
  endpoint?: string
  method?: string
  headers?: Record<string, string>
  body?: JsonObject
  transform_js?: string
  literal_value?: JsonObject | JsonObject[] | string | number | boolean | null
}

interface TerminusSettings {
  // Standard fields
  name?: string
  refresh_interval?: number
  custom_fields?: CustomField[] | JsonObject

  // Kuroshiro's own multi-source round-trip format (issue #776)
  data_sources?: DataSourceEntry[]
  // Rejected: a stale single-source export predating #776 — never coerced
  data_source?: unknown

  // Our previous single-source format
  endpoint?: string
  method?: string
  headers?: Record<string, string>
  body?: JsonObject

  // Actual Terminus format
  polling_url?: string
  polling_verb?: string
  polling_headers?: string
  polling_body?: string
}

// A TRMNL Recipe archive's flat settings.yml also carries these, alongside
// the TerminusSettings fields above (issue #796 / ADR-0010)
interface RecipeSettings extends TerminusSettings {
  description?: string
  oauth_enabled?: boolean
  strategy?: string
  // Terminus schema: `maybe :hash` — a `strategy: static` recipe's fixed
  // payload (issue #794 / ADR-0018)
  static_data?: JsonObject | null
}

interface ParsedDataSource {
  name: string
  mode: 'fetch' | 'literal'
  method?: string
  url?: string
  headers?: Record<string, string>
  body?: JsonObject
  transformJs?: string | null
  literalValue?: JsonObject | JsonObject[] | string | number | boolean | null
}

export interface ParsedPlugin {
  name: string
  description?: string
  kind: PluginKind
  refreshInterval: number
  dataSources: ParsedDataSource[]
  templates: Array<{
    layout: string
    liquidMarkup: string
  }>
  fields: Array<{
    keyname: string
    fieldType: string
    name: string
    description?: string
    defaultValue?: string
    required: boolean
    order: number
  }>
  sourceRecipeId?: string
}

@Injectable()
export class PluginImporterService {
  private readonly logger = new Logger(PluginImporterService.name)

  async importFromFile(filePath: string): Promise<ParsedPlugin> {
    const ext = path.extname(filePath).toLowerCase()
    const filename = path.basename(filePath, ext)

    if (ext === '.zip') {
      return this.importFromZip(filePath, filename)
    }
    else if (ext === '.yml' || ext === '.yaml') {
      return this.importFromYaml(filePath, filename)
    }
    else {
      throw new Error('Unsupported file format. Please upload .yml or .zip file.')
    }
  }

  async importFromGithubUrl(githubUrl: string): Promise<ParsedPlugin> {
    this.logger.log(`Importing plugin from GitHub URL: ${githubUrl}`)

    // Convert GitHub URL to ZIP download URL
    // Supports: https://github.com/owner/repo or https://github.com/owner/repo/tree/branch/path
    let zipUrl = githubUrl

    // Extract owner, repo, branch, and path from various GitHub URL formats
    const repoMatch = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)(?:\/(.+))?)?/)
    if (repoMatch) {
      const [, owner, repo, branch] = repoMatch
      const cleanRepo = repo.replace(/\.git$/, '')
      const branchOrDefault = branch || 'main'
      zipUrl = `https://github.com/${owner}/${cleanRepo}/archive/refs/heads/${branchOrDefault}.zip`
      this.logger.debug(`Converted to ZIP URL: ${zipUrl}`)
    }

    // Download ZIP file
    const uploadsDir = resolveAppPath('uploads')
    await fs.promises.mkdir(uploadsDir, { recursive: true })

    const tempZipPath = path.join(uploadsDir, `github-${Date.now()}.zip`)

    try {
      this.logger.debug(`Downloading from: ${zipUrl}`)
      const response = await fetch(zipUrl)

      if (!response.ok) {
        throw new Error(`Failed to download from GitHub: ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      await fs.promises.writeFile(tempZipPath, buffer)

      this.logger.log(`Downloaded ZIP to: ${tempZipPath}`)

      // Use existing ZIP import logic
      const result = await this.importFromZip(tempZipPath, 'github-import')

      // Clean up temp file
      await fs.promises.unlink(tempZipPath)

      return result
    }
    catch (error) {
      // Clean up temp file on error
      try {
        await fs.promises.unlink(tempZipPath)
      }
      catch {
        // Ignore cleanup errors
      }
      throw error
    }
  }

  private async importFromZip(zipPath: string, fallbackName: string): Promise<ParsedPlugin> {
    const zip = new AdmZip(zipPath)
    return this.parseZip(zip, fallbackName)
  }

  private parseZip(zip: AdmZip, fallbackName: string, forcedDataSources?: ParsedDataSource[]): ParsedPlugin {
    const zipEntries = zip.getEntries()

    this.logger.debug(`ZIP contains ${zipEntries.length} entries:`)
    zipEntries.forEach(entry => this.logger.debug(`  - ${entry.entryName}`))

    // Support nested structures like github-repo-main/plugin/.trmnlp.yml
    const manifestEntry = zipEntries.find(entry =>
      entry.entryName === '.trmnlp.yml' || entry.entryName.endsWith('/.trmnlp.yml'),
    )
    const settingsEntry = zipEntries.find(entry =>
      entry.entryName === 'src/settings.yml' || entry.entryName.endsWith('/src/settings.yml'),
    )

    // Find .liquid files that are in a src/ directory at any nesting level
    const templateEntries = zipEntries.filter((entry) => {
      const parts = entry.entryName.split('/')
      return parts.includes('src') && entry.entryName.endsWith('.liquid')
    })

    if (!manifestEntry) {
      const availableFiles = zipEntries.map(e => e.entryName).join(', ')
      throw new Error(`.trmnlp.yml manifest not found in ZIP. Available files: ${availableFiles}`)
    }

    if (!settingsEntry) {
      const availableFiles = zipEntries.map(e => e.entryName).join(', ')
      throw new Error(`src/settings.yml not found in ZIP. Available files: ${availableFiles}`)
    }

    const manifestContent = manifestEntry.getData().toString('utf8')
    const settingsContent = settingsEntry.getData().toString('utf8')

    const manifest = parseYamlObject<TerminusManifest>(manifestContent, 'Invalid manifest.yml')
    const settings = parseYamlObject<TerminusSettings>(settingsContent, 'Invalid settings.yml')

    // Extract transform.js if it exists (used to process API data)
    const transformEntry = zipEntries.find(entry =>
      entry.entryName.endsWith('/src/transform.js') || entry.entryName === 'src/transform.js',
    )
    const transformJs = transformEntry ? transformEntry.getData().toString('utf8') : null
    if (transformJs) {
      this.logger.debug('Found transform.js, will include in plugin')
    }

    // Extract shared.liquid if it exists (used for {% render "main" %} partials)
    const sharedEntry = templateEntries.find(entry => entry.entryName.endsWith('shared.liquid'))
    const sharedContent = sharedEntry ? sharedEntry.getData().toString('utf8') : null

    // Process layout templates (skip shared.liquid, transform.js, etc.)
    const layoutEntries = templateEntries.filter((entry) => {
      const filename = path.basename(entry.entryName, '.liquid')
      return KNOWN_TEMPLATE_LAYOUT_NAMES.some(layout => filename.includes(layout))
    })

    const templates = layoutEntries.map((entry) => {
      const filename = path.basename(entry.entryName, '.liquid')
      const content = entry.getData().toString('utf8')
      const layout = layoutFromTemplateFilename(filename)

      // If template uses {% render "main" %} and we have shared.liquid, inline it
      let liquidMarkup = content
      if (sharedContent && (content.includes('{% render "main"') || content.includes('{%render "main"'))) {
        // Extract content from {% template main %}...{% endtemplate %} wrapper
        let sharedContentToInline = sharedContent
        const templateMatch = sharedContent.match(/\{%\s*template\s+main\s*%\}([\s\S]*?)\{%\s*endtemplate\s*%\}/i)
        if (templateMatch) {
          sharedContentToInline = templateMatch[1].trim()
        }

        // Replace the render tag with the extracted shared content
        liquidMarkup = content.replace(/\{%\s*render\s+"main"[^%]*%\}/g, sharedContentToInline)
      }

      return {
        layout,
        liquidMarkup,
      }
    })

    return this.buildParsedPlugin(manifest, settings, templates, fallbackName, transformJs ?? undefined, forcedDataSources)
  }

  parseRecipeId(recipeIdOrUrl: string): string {
    const trimmed = recipeIdOrUrl.trim()

    if (/^\d+$/.test(trimmed)) {
      return trimmed
    }

    const match = trimmed.match(/recipes\/(\d+)/)
    if (match) {
      return match[1]
    }

    throw new Error(`Invalid Recipe id or URL: ${recipeIdOrUrl}`)
  }

  async importFromRecipe(recipeIdOrUrl: string): Promise<ParsedPlugin> {
    const recipeId = this.parseRecipeId(recipeIdOrUrl)
    this.logger.log(`Importing plugin from TRMNL Recipe: ${recipeId}`)

    const archiveUrl = `https://trmnl.com/api/plugin_settings/${recipeId}/archive`
    const response = await fetch(archiveUrl)

    if (!response.ok) {
      throw new Error(`Failed to download Recipe archive: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return this.importFromRecipeArchive(Buffer.from(arrayBuffer), recipeId)
  }

  async importFromRecipeArchive(archiveBuffer: Buffer, recipeId: string): Promise<ParsedPlugin> {
    const archiveZip = new AdmZip(archiveBuffer)
    const entries = archiveZip.getEntries()

    const settingsEntry = entries.find(entry => entry.entryName === 'settings.yml')
    if (!settingsEntry) {
      throw new Error('settings.yml not found in Recipe archive')
    }

    const settingsContent = settingsEntry.getData().toString('utf8')
    const recipeSettings = parseYamlObject<RecipeSettings>(settingsContent, 'Invalid settings.yml')

    if (recipeSettings.oauth_enabled) {
      throw new Error('OAuth recipes aren\'t supported yet')
    }

    if (recipeSettings.strategy === 'static') {
      return this.importStaticRecipe(entries, settingsContent, recipeSettings, recipeId)
    }

    if (recipeSettings.strategy !== 'polling') {
      throw new Error(`Recipe strategy "${recipeSettings.strategy ?? 'none'}" is not supported; only "polling" recipes can be imported`)
    }

    const reshapedZip = this.reshapeRecipeArchive(entries, settingsContent, recipeSettings)
    const parsed = this.parseZip(reshapedZip, `recipe-${recipeId}`)

    return {
      ...parsed,
      fields: parsed.fields.map(field => field.fieldType === 'author_bio' ? { ...field, required: false } : field),
      sourceRecipeId: recipeId,
    }
  }

  // A `strategy: static` Recipe carries its fixed payload as `static_data`
  // instead of a `polling_*` endpoint — it imports as a single `literal`-mode
  // Data Source named 'source', matching the existing single-implicit-source
  // naming convention (issue #794 / ADR-0018). Nothing fetches for a literal
  // source, so a `transform.js` alongside it has nothing to transform.
  private importStaticRecipe(entries: AdmZip.IZipEntry[], settingsContent: string, recipeSettings: RecipeSettings, recipeId: string): ParsedPlugin {
    const hasTransform = entries.some(entry =>
      entry.entryName === 'transform.js' || entry.entryName.endsWith('/transform.js'),
    )
    if (hasTransform) {
      throw new Error('Static recipes with a transform.js aren\'t supported — nothing to transform')
    }

    const staticDataSource: ParsedDataSource = {
      name: 'source',
      mode: 'literal',
      literalValue: isPlainObject(recipeSettings.static_data) ? recipeSettings.static_data as JsonObject : {},
    }

    const reshapedZip = this.reshapeRecipeArchive(entries, settingsContent, recipeSettings)
    const parsed = this.parseZip(reshapedZip, `recipe-${recipeId}`, [staticDataSource])

    return {
      ...parsed,
      fields: parsed.fields.map(field => field.fieldType === 'author_bio' ? { ...field, required: false } : field),
      sourceRecipeId: recipeId,
    }
  }

  // A real Recipe archive is flat: settings.yml + *.liquid at the zip root,
  // no .trmnlp.yml manifest, no src/ prefix (ADR-0010). Reshape it into the
  // shape parseZip already expects, rather than duplicating its field mapping.
  private reshapeRecipeArchive(entries: AdmZip.IZipEntry[], settingsContent: string, recipeSettings: RecipeSettings): AdmZip {
    const manifest: TerminusManifest = {
      name: recipeSettings.name || '',
      description: recipeSettings.description,
      custom_fields: Array.isArray(recipeSettings.custom_fields) ? recipeSettings.custom_fields : undefined,
    }

    const reshaped = new AdmZip()
    reshaped.addFile('.trmnlp.yml', Buffer.from(yaml.dump(manifest), 'utf8'))
    reshaped.addFile('src/settings.yml', Buffer.from(settingsContent, 'utf8'))

    for (const entry of entries) {
      if (entry.isDirectory || entry.entryName === 'settings.yml') {
        continue
      }
      reshaped.addFile(`src/${entry.entryName}`, entry.getData())
    }

    return reshaped
  }

  private async importFromYaml(yamlPath: string, fallbackName: string): Promise<ParsedPlugin> {
    const content = await fs.promises.readFile(yamlPath, 'utf8')
    const manifest = parseYamlObject<TerminusManifest>(content, 'Invalid manifest.yml')

    const dirName = path.dirname(yamlPath)
    const settingsPath = path.join(dirName, 'src', 'settings.yml')

    if (!fs.existsSync(settingsPath)) {
      throw new Error('src/settings.yml not found')
    }

    const settingsContent = await fs.promises.readFile(settingsPath, 'utf8')
    const settings = parseYamlObject<TerminusSettings>(settingsContent, 'Invalid settings.yml')

    const srcDir = path.join(dirName, 'src')
    const templates: Array<{ layout: string, liquidMarkup: string }> = []

    // Check for transform.js
    const transformPath = path.join(srcDir, 'transform.js')
    const transformJs = fs.existsSync(transformPath)
      ? await fs.promises.readFile(transformPath, 'utf8')
      : null
    if (transformJs) {
      this.logger.debug('Found transform.js, will include in plugin')
    }

    if (fs.existsSync(srcDir)) {
      const files = await fs.promises.readdir(srcDir)
      const liquidFiles = files.filter(f => f.endsWith('.liquid'))

      for (const file of liquidFiles) {
        const filePath = path.join(srcDir, file)
        const content = await fs.promises.readFile(filePath, 'utf8')
        const filename = path.basename(file, '.liquid')
        const layout = layoutFromTemplateFilename(filename)

        templates.push({
          layout,
          liquidMarkup: content,
        })
      }
    }

    return this.buildParsedPlugin(manifest, settings, templates, fallbackName, transformJs ?? undefined)
  }

  private buildParsedPlugin(
    manifest: TerminusManifest,
    settings: TerminusSettings,
    templates: Array<{ layout: string, liquidMarkup: string }>,
    fallbackName: string,
    transformJs?: string,
    forcedDataSources?: ParsedDataSource[],
  ): ParsedPlugin {
    this.logger.debug(`Parsed manifest: ${JSON.stringify(manifest)}`)
    this.logger.debug(`Parsed settings: ${JSON.stringify(settings)}`)
    this.logger.debug(`Found ${templates.length} templates`)

    const { name: pluginName, source: nameSource } = this.resolvePluginName(manifest, settings, fallbackName)
    this.logger.log(`Using plugin name: ${pluginName} (from ${nameSource})`)

    if (settings.data_source) {
      throw new Error('This plugin was exported in a legacy single-data-source format that is no longer supported. Re-export it from its source Plugin to get the current "data_sources" format.')
    }

    if (templates.length === 0) {
      throw new Error('At least one .liquid template file is required in src/ directory (e.g., src/full.liquid)')
    }

    const dataSources = forcedDataSources ?? this.resolveDataSources(settings, transformJs)
    const fields = this.resolveFields(manifest, settings)

    return {
      name: pluginName,
      description: manifest.description?.trim(),
      kind: 'Poll',
      refreshInterval: settings.refresh_interval || 15,
      dataSources,
      templates,
      fields,
    }
  }

  // Name can be in manifest, settings, or use filename fallback
  private resolvePluginName(
    manifest: TerminusManifest,
    settings: TerminusSettings,
    fallbackName: string,
  ): { name: string, source: 'manifest' | 'settings' | 'filename' } {
    const name = (manifest.name && manifest.name.trim() !== '')
      ? manifest.name.trim()
      : (settings.name && settings.name.trim() !== '')
          ? settings.name.trim()
          : fallbackName.replace(/[_-]/g, ' ').replace(/\.trmnlp$/, '')

    const source = manifest.name ? 'manifest' : settings.name ? 'settings' : 'filename'

    return { name, source }
  }

  private resolveDataSources(settings: TerminusSettings, transformJs?: string): ParsedDataSource[] {
    const hasDataSourcesArray = Array.isArray(settings.data_sources) && settings.data_sources.length > 0

    if (hasDataSourcesArray && transformJs) {
      this.logger.warn('Ignoring src/transform.js: settings.yml uses the "data_sources" array format, where each entry carries its own "transform_js" instead')
    }

    return hasDataSourcesArray
      ? this.parseDataSourcesArray(settings.data_sources!)
      : [this.parseLegacySingleDataSource(settings, transformJs)]
  }

  // custom_fields can be in manifest or settings, can be empty object {}, missing, or an array
  private resolveFields(manifest: TerminusManifest, settings: TerminusSettings): ParsedPlugin['fields'] {
    const customFieldsSource = Array.isArray(manifest.custom_fields)
      ? manifest.custom_fields
      : Array.isArray(settings.custom_fields)
        ? settings.custom_fields
        : []

    return customFieldsSource.map((field, index) => ({
      keyname: field.keyname,
      fieldType: field.field_type,
      name: field.name,
      description: field.description,
      defaultValue: field.default_value,
      required: !field.optional,
      order: index + 1,
    }))
  }

  private parseDataSourcesArray(entries: DataSourceEntry[]): ParsedDataSource[] {
    return entries.map((entry, index) => {
      const name = entry.name && entry.name.trim() !== '' ? entry.name.trim() : `source_${index + 1}`

      return entry.mode === 'literal'
        ? this.parseLiteralEntry(entry, name)
        : this.parseFetchEntry(entry, name, index)
    })
  }

  private parseLiteralEntry(entry: DataSourceEntry, name: string): ParsedDataSource {
    return {
      name,
      mode: 'literal',
      literalValue: entry.literal_value ?? {},
    }
  }

  private parseFetchEntry(entry: DataSourceEntry, name: string, index: number): ParsedDataSource {
    if (!entry.endpoint || entry.endpoint.trim() === '') {
      throw new Error(`Data source at index ${index} is missing an "endpoint"`)
    }

    return {
      name,
      mode: 'fetch',
      method: (entry.method || 'GET').toUpperCase(),
      url: entry.endpoint.trim(),
      headers: entry.headers || {},
      body: entry.body || {},
      transformJs: entry.transform_js || null,
    }
  }

  private parseLegacySingleDataSource(settings: TerminusSettings, transformJs?: string): ParsedDataSource {
    // Support both our previous format (endpoint/method) and Terminus's own format (polling_url/polling_verb)
    const endpoint = settings.endpoint || settings.polling_url

    if (!endpoint || endpoint.trim() === '') {
      throw new Error('Data source endpoint is required in src/settings.yml. Expected format:\npolling_url: https://api.example.com/data\npolling_verb: get')
    }

    return {
      name: 'source',
      mode: 'fetch',
      method: (settings.method || settings.polling_verb)?.toUpperCase() || 'GET',
      url: endpoint.trim(),
      headers: this.parseLegacyJsonField(settings.headers, settings.polling_headers, 'polling_headers'),
      body: this.parseLegacyJsonField(settings.body, settings.polling_body, 'polling_body'),
      transformJs: transformJs || null,
    }
  }

  // Terminus ships headers/body as JSON-encoded strings (polling_headers/polling_body);
  // our own format carries them as plain objects. Falls back to the plain-object value
  // (or {}) if the string isn't valid JSON.
  private parseLegacyJsonField<T>(fallback: T | undefined, raw: string | undefined, fieldName: string): T {
    if (typeof raw === 'string' && raw.trim()) {
      try {
        return JSON.parse(raw) as T
      }
      catch {
        this.logger.warn(`Failed to parse ${fieldName} as JSON, using empty object`)
      }
    }
    return (fallback ?? {}) as T
  }
}
