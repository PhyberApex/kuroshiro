import type { Plugin } from '../entities/plugin.entity.js'
import { Buffer } from 'node:buffer'
import { Injectable, Logger } from '@nestjs/common'
import AdmZip from 'adm-zip'
import * as yaml from 'js-yaml'
import { formatFieldAttributes, formatFieldOptions } from '../plugin-field-options.js'

export interface PluginExportEntry {
  path: string
  content: Buffer
}

/** A nullable value under its key, or no key when it is null, so an import reads it back as null rather than as ''. */
function keyUnlessNull<K extends string>(key: K, value: string | null | undefined): Partial<Record<K, string>> {
  return value === null || value === undefined ? {} : { [key]: value } as Record<K, string>
}

@Injectable()
export class PluginExporterService {
  private readonly logger = new Logger(PluginExporterService.name)

  /** The `.trmnlp` file entries for a Plugin, in the shape `exportToZip` writes to a zip — exposed so a whole-server Configuration Export can nest them under `plugins/<id>/` without re-deriving the format. */
  buildEntries(plugin: Plugin): PluginExportEntry[] {
    const entries: PluginExportEntry[] = []

    const manifest = {
      name: plugin.name,
      ...keyUnlessNull('description', plugin.description),
      custom_fields: [...plugin.fields ?? []].sort((a, b) => a.order - b.order).map(field => ({
        keyname: field.keyname,
        field_type: field.fieldType,
        name: field.name,
        ...keyUnlessNull('description', field.description),
        ...keyUnlessNull('default_value', field.defaultValue),
        ...(field.options ? { options: formatFieldOptions(field.options) } : {}),
        optional: !field.required,
        order: field.order,
        ...formatFieldAttributes(field.attributes),
      })),
    }

    entries.push({ path: '.trmnlp.yml', content: Buffer.from(yaml.dump(manifest), 'utf8') })

    entries.push({ path: 'src/settings.yml', content: Buffer.from(yaml.dump(this.buildSettings(plugin)), 'utf8') })

    if (plugin.templates && plugin.templates.length > 0) {
      for (const template of plugin.templates) {
        entries.push({ path: `src/${template.layout}.liquid`, content: Buffer.from(template.liquidMarkup, 'utf8') })
      }
    }

    return entries
  }

  /** `strategy` is the key a TRMNL Recipe names its kind with, so an export says which Plugin Kind it holds. */
  private buildSettings(plugin: Plugin) {
    const frameworkVersion = plugin.frameworkVersion ? { framework_version: plugin.frameworkVersion } : {}
    const modifiers = { no_screen_padding: plugin.noScreenPadding ? 'yes' : 'no', dark_mode: plugin.darkMode ? 'yes' : 'no' }

    if (plugin.kind === 'Webhook') {
      return { strategy: 'webhook', merge_strategy: plugin.mergeStrategy, stream_limit: plugin.streamLimit ?? null, ...frameworkVersion, ...modifiers }
    }

    return {
      strategy: 'polling',
      ...frameworkVersion,
      ...modifiers,
      ...plugin.oauthSettings,
      refresh_interval: plugin.refreshInterval,
      data_sources: [...plugin.dataSources ?? []]
        .sort((a, b) => a.order - b.order)
        .map(source => source.mode === 'literal'
          ? {
              name: source.name,
              mode: 'literal',
              literal_value: source.literalValue ?? null,
              ...(source.transformJs ? { transform_js: source.transformJs } : {}),
            }
          : {
              name: source.name,
              endpoint: source.url,
              method: source.method,
              headers: source.headers || {},
              body: source.body || {},
              ...(source.transformJs ? { transform_js: source.transformJs } : {}),
            }),
    }
  }

  async exportToZip(plugin: Plugin): Promise<Buffer> {
    const zip = new AdmZip()
    for (const entry of this.buildEntries(plugin)) {
      zip.addFile(entry.path, entry.content)
    }
    return zip.toBuffer()
  }
}
