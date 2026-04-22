import { Buffer } from 'node:buffer'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Injectable, Logger } from '@nestjs/common'
import AdmZip from 'adm-zip'
import * as yaml from 'js-yaml'
import { resolveAppPath } from '../../utils/pathHelper'

interface TerminusManifest {
  name: string
  description?: string
  custom_fields?: CustomField[]
  variables?: Record<string, any>
}

interface CustomField {
  keyname: string
  field_type: string
  name: string
  description?: string
  default_value?: string
  optional?: boolean
}

interface TerminusSettings {
  // Standard fields
  name?: string
  refresh_interval?: number
  custom_fields?: CustomField[] | Record<string, any>

  // Our expected format
  endpoint?: string
  method?: string
  headers?: Record<string, string>
  body?: Record<string, any>

  // Actual Terminus format
  polling_url?: string
  polling_verb?: string
  polling_headers?: string
  polling_body?: string
}

interface ParsedPlugin {
  name: string
  description?: string
  kind: string
  refreshInterval: number
  dataSource: {
    method: string
    url: string
    headers?: Record<string, string>
    body?: Record<string, any>
    transformJs?: string
  }
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

    const manifest = yaml.load(manifestContent) as TerminusManifest
    const settings = yaml.load(settingsContent) as TerminusSettings

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
      return ['full', 'half_horizontal', 'half_vertical', 'quadrant'].some(layout => filename.includes(layout))
    })

    const templates = layoutEntries.map((entry) => {
      const filename = path.basename(entry.entryName, '.liquid')
      const content = entry.getData().toString('utf8')

      let layout = 'full'
      if (filename.includes('half_horizontal'))
        layout = 'half_horizontal'
      else if (filename.includes('half_vertical'))
        layout = 'half_vertical'
      else if (filename.includes('quadrant'))
        layout = 'quadrant'

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

    return this.buildParsedPlugin(manifest, settings, templates, fallbackName, transformJs)
  }

  private async importFromYaml(yamlPath: string, fallbackName: string): Promise<ParsedPlugin> {
    const content = await fs.promises.readFile(yamlPath, 'utf8')
    const manifest = yaml.load(content) as TerminusManifest

    const dirName = path.dirname(yamlPath)
    const settingsPath = path.join(dirName, 'src', 'settings.yml')

    if (!fs.existsSync(settingsPath)) {
      throw new Error('src/settings.yml not found')
    }

    const settingsContent = await fs.promises.readFile(settingsPath, 'utf8')
    const settings = yaml.load(settingsContent) as TerminusSettings

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

        let layout = 'full'
        if (filename.includes('half_horizontal'))
          layout = 'half_horizontal'
        else if (filename.includes('half_vertical'))
          layout = 'half_vertical'
        else if (filename.includes('quadrant'))
          layout = 'quadrant'

        templates.push({
          layout,
          liquidMarkup: content,
        })
      }
    }

    return this.buildParsedPlugin(manifest, settings, templates, fallbackName, transformJs)
  }

  private buildParsedPlugin(
    manifest: TerminusManifest,
    settings: TerminusSettings,
    templates: Array<{ layout: string, liquidMarkup: string }>,
    fallbackName: string,
    transformJs?: string,
  ): ParsedPlugin {
    this.logger.debug(`Parsed manifest: ${JSON.stringify(manifest)}`)
    this.logger.debug(`Parsed settings: ${JSON.stringify(settings)}`)
    this.logger.debug(`Found ${templates.length} templates`)

    // Name can be in manifest, settings, or use filename fallback
    const pluginName = (manifest.name && manifest.name.trim() !== '')
      ? manifest.name.trim()
      : (settings.name && settings.name.trim() !== '')
          ? settings.name.trim()
          : fallbackName.replace(/[_-]/g, ' ').replace(/\.trmnlp$/, '')

    const nameSource = manifest.name ? 'manifest' : settings.name ? 'settings' : 'filename'
    this.logger.log(`Using plugin name: ${pluginName} (from ${nameSource})`)

    // Support both our format (endpoint/method) and Terminus format (polling_url/polling_verb)
    const endpoint = settings.endpoint || settings.polling_url
    const method = settings.method || settings.polling_verb

    if (!endpoint || endpoint.trim() === '') {
      throw new Error('Data source endpoint is required in src/settings.yml. Expected format:\npolling_url: https://api.example.com/data\npolling_verb: get')
    }

    if (templates.length === 0) {
      throw new Error('At least one .liquid template file is required in src/ directory (e.g., src/full.liquid)')
    }

    // Parse headers if they're a string (Terminus format)
    let headers = settings.headers || {}
    if (typeof settings.polling_headers === 'string' && settings.polling_headers.trim()) {
      try {
        headers = JSON.parse(settings.polling_headers)
      }
      catch {
        this.logger.warn('Failed to parse polling_headers as JSON, using empty object')
      }
    }

    // Parse body if it's a string (Terminus format)
    let body = settings.body || {}
    if (typeof settings.polling_body === 'string' && settings.polling_body.trim()) {
      try {
        body = JSON.parse(settings.polling_body)
      }
      catch {
        this.logger.warn('Failed to parse polling_body as JSON, using empty object')
      }
    }

    // custom_fields can be in manifest or settings, can be empty object {}, missing, or an array
    const customFieldsSource = Array.isArray(manifest.custom_fields)
      ? manifest.custom_fields
      : Array.isArray(settings.custom_fields)
        ? settings.custom_fields
        : []
    const fields = customFieldsSource.map((field, index) => ({
      keyname: field.keyname,
      fieldType: field.field_type,
      name: field.name,
      description: field.description,
      defaultValue: field.default_value,
      required: !field.optional,
      order: index + 1,
    }))

    return {
      name: pluginName,
      description: manifest.description?.trim(),
      kind: 'Poll',
      refreshInterval: settings.refresh_interval || 15,
      dataSource: {
        method: method?.toUpperCase() || 'GET',
        url: endpoint.trim(),
        headers,
        body,
        transformJs,
      },
      templates,
      fields,
    }
  }
}
