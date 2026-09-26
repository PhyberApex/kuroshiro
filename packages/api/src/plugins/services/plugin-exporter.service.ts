import type { Plugin } from '../entities/plugin.entity.js'
import { Buffer } from 'node:buffer'
import { Injectable, Logger } from '@nestjs/common'
import AdmZip from 'adm-zip'
import * as yaml from 'js-yaml'

export interface PluginExportEntry {
  path: string
  content: Buffer
}

@Injectable()
export class PluginExporterService {
  private readonly logger = new Logger(PluginExporterService.name)

  /** The `.trmnlp` file entries for a Plugin, in the shape `exportToZip` writes to a zip — exposed so a whole-server Configuration Export can nest them under `plugins/<id>/` without re-deriving the format. */
  buildEntries(plugin: Plugin): PluginExportEntry[] {
    const entries: PluginExportEntry[] = []

    const manifest = {
      name: plugin.name,
      description: plugin.description || '',
      custom_fields: (plugin.fields || []).map(field => ({
        keyname: field.keyname,
        field_type: field.fieldType,
        name: field.name,
        description: field.description || '',
        default_value: field.defaultValue || '',
        optional: !field.required,
      })),
    }

    entries.push({ path: '.trmnlp.yml', content: Buffer.from(yaml.dump(manifest), 'utf8') })

    if (plugin.dataSources && plugin.dataSources.length > 0) {
      const settings = {
        refresh_interval: plugin.refreshInterval,
        data_sources: [...plugin.dataSources]
          .sort((a, b) => a.order - b.order)
          .map(source => source.mode === 'literal'
            ? {
                name: source.name,
                mode: 'literal',
                literal_value: source.literalValue ?? null,
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

      entries.push({ path: 'src/settings.yml', content: Buffer.from(yaml.dump(settings), 'utf8') })
    }

    if (plugin.templates && plugin.templates.length > 0) {
      for (const template of plugin.templates) {
        entries.push({ path: `src/${template.layout}.liquid`, content: Buffer.from(template.liquidMarkup, 'utf8') })
      }
    }

    return entries
  }

  async exportToZip(plugin: Plugin): Promise<Buffer> {
    const zip = new AdmZip()
    for (const entry of this.buildEntries(plugin)) {
      zip.addFile(entry.path, entry.content)
    }
    return zip.toBuffer()
  }
}
