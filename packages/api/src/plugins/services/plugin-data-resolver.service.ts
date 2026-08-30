import type { Plugin } from '../entities/plugin.entity'
import { Injectable, Logger } from '@nestjs/common'
import { PluginDataFetcherService } from './plugin-data-fetcher.service'
import { PluginTransformService } from './plugin-transform.service'

@Injectable()
export class PluginDataResolverService {
  private readonly logger = new Logger(PluginDataResolverService.name)

  constructor(
    private readonly pluginDataFetcher: PluginDataFetcherService,
    private readonly pluginTransformer: PluginTransformService,
  ) {}

  /**
   * Fetches every one of a Plugin's Data Sources in parallel and applies its
   * transform.js, if any. A source that fails gets an error marker instead of
   * aborting the whole render (ADR-0005); a literal-mode source has no fetch
   * to make — it contributes its stored value directly, with no call to the
   * data fetcher at all. Shared by every render path (device display, mashup
   * slot) that turns a Plugin's Data Sources into template data.
   */
  async resolveDataSources(plugin: Plugin, templateContext?: object): Promise<Record<string, unknown>> {
    const results = await Promise.allSettled(
      plugin.dataSources.map(async (source) => {
        let rawData = await this.pluginDataFetcher.fetchOrLiteral(source, templateContext)
        if (source.transformJs) {
          this.logger.debug(`Applying transform.js to data source: ${source.name}`)
          rawData = this.pluginTransformer.transform(source.transformJs, rawData)
        }
        return rawData
      }),
    )

    const data: Record<string, unknown> = {}
    results.forEach((result, index) => {
      const name = plugin.dataSources[index].name
      if (result.status === 'fulfilled') {
        data[name] = result.value
      }
      else {
        this.logger.warn(`Data source "${name}" failed for plugin ${plugin.id}: ${result.reason?.message || result.reason}`)
        data[name] = { error: true, message: result.reason?.message || String(result.reason) }
      }
    })
    return data
  }
}
