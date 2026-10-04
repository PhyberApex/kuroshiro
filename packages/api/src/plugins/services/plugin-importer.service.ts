import type { MergeStrategy, PluginFieldOption, PluginKind } from 'kuroshiro-shared'
import type { JsonObject } from '../../utils/json.js'
import { Buffer } from 'node:buffer'
import * as path from 'node:path'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import AdmZip from 'adm-zip'
import * as yaml from 'js-yaml'
import { githubRepositoryOf, MERGE_STRATEGIES, recipeIdOf } from 'kuroshiro-shared'
import { ApiException } from '../../errors/api.exception.js'
import { isPlainObject } from '../../utils/json.js'
import { parseFieldOptions } from '../plugin-field-options.js'

const DOWNLOAD_TIMEOUT_MS = 30_000

function importRefused(code: 'import-no-plugin' | 'import-legacy-format' | 'unprocessable', message: string): ApiException {
  return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, code, message)
}

function upstreamUnreachable(upstream: string, reason: string): ApiException {
  return new ApiException(HttpStatus.BAD_GATEWAY, 'upstream-unreachable', `${upstream} did not answer: ${reason}`, { reason })
}

function parseYamlObject<T>(content: string, invalidMessage: string): T {
  let parsed: unknown
  try {
    parsed = yaml.load(content)
  }
  catch {
    throw importRefused('import-no-plugin', invalidMessage)
  }
  if (!isPlainObject(parsed)) {
    throw importRefused('import-no-plugin', invalidMessage)
  }
  return parsed as T
}

function openZip(content: Buffer): AdmZip | null {
  try {
    const zip = new AdmZip(content)
    zip.getEntries()
    return zip
  }
  catch {
    return null
  }
}

/** A Plugin is rendered from its `full` Template, so an import that brings none of that size has its first one take the place. */
function withFullTemplate(plugin: ParsedPlugin): ParsedPlugin {
  if (plugin.templates.some(template => template.layout === 'full'))
    return plugin
  const [first, ...others] = plugin.templates
  return { ...plugin, templates: [{ ...first, layout: 'full' }, ...others] }
}

// TRMNL writes a default under `default`, as a string, a number or a boolean; Kuroshiro's export under `default_value`.
function defaultOf(field: CustomField): string | undefined {
  const value = field.default_value ?? field.default
  return value === undefined || value === null ? undefined : String(value)
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
  field_type?: string
  name?: string
  description?: string
  default_value?: string
  default?: string | number | boolean | null
  optional?: boolean
  options?: unknown
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

  // The Plugin Kind as Kuroshiro's export and TRMNL's own archives name it, with what a Webhook-kind Plugin carries
  strategy?: string
  merge_strategy?: string
  stream_limit?: number | null

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
  // Terminus schema: `maybe :hash` — a `strategy: static` recipe's fixed
  // payload (issue #794 / ADR-0018)
  static_data?: JsonObject | null
}

/** A Plugin read from a Recipe, tied to it by the Recipe's id. */
export type RecipePlugin = ParsedPlugin & { sourceRecipeId: string }

export interface ParsedDataSource {
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
  /** Webhook only. */
  mergeStrategy?: MergeStrategy
  /** Webhook with `stream` only. */
  streamLimit?: number
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
    options?: PluginFieldOption[]
    required: boolean
    order: number
  }>
  sourceRecipeId?: string
}

@Injectable()
export class PluginImporterService {
  private readonly logger = new Logger(PluginImporterService.name)

  /** Reads an uploaded `.trmnlp` zip, which is held in memory, and answers it with the file's name. */
  importFromUpload(file: { buffer: Buffer, originalname: string } | undefined): { plugin: ParsedPlugin, fileName: string } {
    const zip = file && /\.zip$/i.test(file.originalname) ? openZip(file.buffer) : null
    if (!file || !zip) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'import-not-zip', 'A Plugin is imported from a .zip file.')
    }
    return { plugin: withFullTemplate(this.parseZip(zip, file.originalname.replace(/\.zip$/i, ''))), fileName: file.originalname }
  }

  /** Reads the Plugin at the root of a public repository's branch `main`, and answers it with `owner/repository`. */
  async importFromGithubUrl(githubUrl: string): Promise<{ plugin: ParsedPlugin, repository: string }> {
    const repository = githubRepositoryOf(githubUrl)
    if (!repository) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'github-url-invalid', 'The address is not https://github.com/{owner}/{repository}.')
    }
    this.logger.log(`Importing plugin from GitHub: ${repository}`)

    const archive = await this.download(`https://github.com/${repository}/archive/refs/heads/main.zip`, 'GitHub')
    if (!archive) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'github-repo-not-found', `GitHub has no public repository ${repository} with a branch main.`, { repository })
    }
    const zip = openZip(archive)
    if (!zip) {
      throw upstreamUnreachable('GitHub', 'what it answered is not a .zip')
    }
    return { plugin: withFullTemplate(this.parseZip(zip, repository.split('/')[1])), repository }
  }

  /** What the address holds, or `null` when the upstream says there is nothing there. */
  private async download(url: string, upstream: string): Promise<Buffer | null> {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) })
      if (response.status === 404)
        return null
      if (!response.ok)
        throw new Error(`it answered ${response.status}`)
      return Buffer.from(await response.arrayBuffer())
    }
    catch (error) {
      throw upstreamUnreachable(upstream, error instanceof Error ? error.message : String(error))
    }
  }

  /** Parses a `.trmnlp` zip already in memory (e.g. a `plugins/<id>/` folder extracted from a Configuration Archive) through the same manifest/settings/template mapping an uploaded one gets. */
  parseZip(zip: AdmZip, fallbackName: string, forcedDataSources?: ParsedDataSource[]): ParsedPlugin {
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
      throw importRefused('import-no-plugin', `.trmnlp.yml manifest not found in ZIP. Available files: ${availableFiles}`)
    }

    const manifest = parseYamlObject<TerminusManifest>(manifestEntry.getData().toString('utf8'), 'Invalid manifest.yml')
    const settings = settingsEntry
      ? parseYamlObject<TerminusSettings>(settingsEntry.getData().toString('utf8'), 'Invalid settings.yml')
      : {}

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

  async importFromRecipe(recipeIdOrUrl: string): Promise<RecipePlugin> {
    const recipeId = recipeIdOf(recipeIdOrUrl)
    if (!recipeId) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'recipe-id-invalid', 'A Recipe is named by its id or by an address holding recipes/{id}.')
    }
    this.logger.log(`Importing plugin from TRMNL Recipe: ${recipeId}`)

    const archive = await this.download(`https://trmnl.com/api/plugin_settings/${recipeId}/archive`, 'TRMNL')
    if (!archive) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'recipe-not-found', `TRMNL has no Recipe ${recipeId}.`, { id: recipeId })
    }
    return this.importFromRecipeArchive(archive, recipeId)
  }

  async importFromRecipeArchive(archiveBuffer: Buffer, recipeId: string): Promise<RecipePlugin> {
    const entries = openZip(archiveBuffer)?.getEntries()
    const settingsEntry = entries?.find(entry => entry.entryName === 'settings.yml')
    if (!entries || !settingsEntry) {
      throw upstreamUnreachable('TRMNL', 'what it answered is not a Recipe archive')
    }

    const settingsContent = settingsEntry.getData().toString('utf8')
    const recipeSettings = parseYamlObject<RecipeSettings>(settingsContent, 'Invalid settings.yml')

    if (recipeSettings.oauth_enabled) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'recipe-oauth', 'The Recipe signs in to another service with OAuth, which is not supported.')
    }

    if (recipeSettings.strategy === 'static') {
      return this.importStaticRecipe(entries, settingsContent, recipeSettings, recipeId)
    }

    if (recipeSettings.strategy !== 'polling') {
      const strategy = recipeSettings.strategy ?? 'none'
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'recipe-strategy-unsupported', `The Recipe's strategy "${strategy}" is not supported; only "polling" and "static" Recipes can be imported.`, { strategy })
    }

    const reshapedZip = this.reshapeRecipeArchive(entries, settingsContent, recipeSettings)
    const parsed = withFullTemplate(this.parseZip(reshapedZip, `recipe-${recipeId}`))

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
  private importStaticRecipe(entries: AdmZip.IZipEntry[], settingsContent: string, recipeSettings: RecipeSettings, recipeId: string): RecipePlugin {
    const hasTransform = entries.some(entry =>
      entry.entryName === 'transform.js' || entry.entryName.endsWith('/transform.js'),
    )
    if (hasTransform) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'recipe-static-transform', 'The Recipe holds fixed data and a transform.js, which has nothing to transform.')
    }

    const staticDataSource: ParsedDataSource = {
      name: 'source',
      mode: 'literal',
      literalValue: isPlainObject(recipeSettings.static_data) ? recipeSettings.static_data as JsonObject : {},
    }

    const reshapedZip = this.reshapeRecipeArchive(entries, settingsContent, recipeSettings)
    const parsed = withFullTemplate(this.parseZip(reshapedZip, `recipe-${recipeId}`, [staticDataSource]))

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
      throw importRefused('import-legacy-format', 'This plugin was exported in a legacy single-data-source format that is no longer supported. Re-export it from its source Plugin to get the current "data_sources" format.')
    }

    if (templates.length === 0) {
      throw importRefused('import-no-plugin', 'At least one .liquid template file is required in src/ directory (e.g., src/full.liquid)')
    }

    const common = {
      name: pluginName,
      description: manifest.description?.trim(),
      refreshInterval: settings.refresh_interval || 15,
      templates,
      fields: this.resolveFields(manifest, settings),
    }

    return settings.strategy === 'webhook'
      ? { ...common, kind: 'Webhook', dataSources: [], ...this.resolveMerge(settings) }
      : { ...common, kind: 'Poll', dataSources: forcedDataSources ?? this.resolveDataSources(settings, transformJs) }
  }

  // An archive of TRMNL's own names the strategy alone, which is a Webhook Payload replaced at every POST.
  private resolveMerge(settings: TerminusSettings): Pick<ParsedPlugin, 'mergeStrategy' | 'streamLimit'> {
    const mergeStrategy = MERGE_STRATEGIES.find(strategy => strategy === settings.merge_strategy) ?? 'standard'
    if (mergeStrategy !== 'stream')
      return { mergeStrategy }
    const streamLimit = settings.stream_limit
    if (typeof streamLimit !== 'number' || !Number.isInteger(streamLimit) || streamLimit < 1) {
      throw importRefused('unprocessable', 'The Merge Strategy "stream" needs a "stream_limit" that is a whole number of 1 or more.')
    }
    return { mergeStrategy, streamLimit }
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
    if (!Array.isArray(settings.data_sources)) {
      const single = this.parseLegacySingleDataSource(settings, transformJs)
      return single ? [single] : []
    }

    if (transformJs) {
      this.logger.warn('Ignoring src/transform.js: settings.yml uses the "data_sources" array format, where each entry carries its own "transform_js" instead')
    }
    return this.parseDataSourcesArray(settings.data_sources)
  }

  // custom_fields can be in manifest or settings, can be empty object {}, missing, or an array
  private resolveFields(manifest: TerminusManifest, settings: TerminusSettings): ParsedPlugin['fields'] {
    const customFieldsSource = Array.isArray(manifest.custom_fields)
      ? manifest.custom_fields
      : Array.isArray(settings.custom_fields)
        ? settings.custom_fields
        : []

    return customFieldsSource.map((field, index) => {
      const options = parseFieldOptions(field.options)
      return {
        keyname: field.keyname,
        fieldType: field.field_type ?? 'string',
        name: field.name ?? field.keyname,
        description: field.description,
        defaultValue: defaultOf(field),
        ...(options ? { options } : {}),
        required: !field.optional,
        order: index + 1,
      }
    })
  }

  private parseDataSourcesArray(entries: DataSourceEntry[]): ParsedDataSource[] {
    return entries.map((entry, index) => {
      const name = entry.name && entry.name.trim() !== '' ? entry.name.trim() : `source_${index + 1}`

      return entry.mode === 'literal'
        ? this.parseLiteralEntry(entry, name)
        : this.parseFetchEntry(entry, name)
    })
  }

  private parseLiteralEntry(entry: DataSourceEntry, name: string): ParsedDataSource {
    return {
      name,
      mode: 'literal',
      literalValue: entry.literal_value ?? {},
    }
  }

  private parseFetchEntry(entry: DataSourceEntry, name: string): ParsedDataSource {
    if (!entry.endpoint || entry.endpoint.trim() === '') {
      throw importRefused('unprocessable', `The Data Source "${name}" is missing an "endpoint".`)
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

  /** The one Data Source of settings that name an address at their top, or none when they name no address: a Poll-kind Plugin renders without Data Sources. */
  private parseLegacySingleDataSource(settings: TerminusSettings, transformJs?: string): ParsedDataSource | null {
    // Support both our previous format (endpoint/method) and Terminus's own format (polling_url/polling_verb)
    const endpoint = settings.endpoint || settings.polling_url

    if (!endpoint || endpoint.trim() === '') {
      return null
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
