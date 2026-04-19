import type { Plugin } from '../entities/plugin.entity'
import { Buffer } from 'node:buffer'
import { Injectable, Logger } from '@nestjs/common'
import AdmZip from 'adm-zip'
import * as yaml from 'js-yaml'

@Injectable()
export class PluginExporterService {
  private readonly logger = new Logger(PluginExporterService.name)

  async exportToZip(plugin: Plugin): Promise<Buffer> {
    const zip = new AdmZip()

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

    const manifestYaml = yaml.dump(manifest)
    zip.addFile('.trmnlp.yml', Buffer.from(manifestYaml, 'utf8'))

    if (plugin.dataSource) {
      const settings = {
        refresh_interval: plugin.refreshInterval,
        endpoint: plugin.dataSource.url,
        method: plugin.dataSource.method,
        headers: plugin.dataSource.headers || {},
        body: plugin.dataSource.body || {},
      }

      const settingsYaml = yaml.dump(settings)
      zip.addFile('src/settings.yml', Buffer.from(settingsYaml, 'utf8'))
    }

    if (plugin.templates && plugin.templates.length > 0) {
      for (const template of plugin.templates) {
        const filename = `src/${template.layout}.liquid`
        zip.addFile(filename, Buffer.from(template.liquidMarkup, 'utf8'))
      }
    }

    return zip.toBuffer()
  }
}
