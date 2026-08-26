import type { FetchableDataSource } from './plugin-data-fetcher.service'
import { Injectable, Logger } from '@nestjs/common'
import { getErrorMessage } from '../../utils/getErrorMessage'
import { PluginDataFetcherService } from './plugin-data-fetcher.service'
import { PluginTransformService } from './plugin-transform.service'

// The subset of a Data Source's fields resolveAll needs — shared by the
// PluginDataSource entity and PreviewSourceDto, which carry the same fields
// under slightly different types.
export interface ResolvableDataSource extends FetchableDataSource {
  name: string
  transformJs?: string | null
}

@Injectable()
export class PluginDataResolverService {
  private readonly logger = new Logger(PluginDataResolverService.name)

  constructor(
    private readonly dataFetcher: PluginDataFetcherService,
    private readonly transformer: PluginTransformService,
  ) {}

  /**
   * Fetches every Data Source in parallel and applies its transform.js if
   * set. A source that fails gets an error marker instead of aborting the
   * whole call (ADR-0005) — every render/mashup/preview path that turns a
   * Plugin's Data Sources into template data should go through this rather
   * than re-deriving the fetch/transform/error-marker logic itself.
   */
  async resolveAll(dataSources: ResolvableDataSource[], templateContext?: object): Promise<Record<string, unknown>> {
    const results = await Promise.allSettled(
      dataSources.map(async (source) => {
        let rawData = await this.dataFetcher.fetchOrLiteral(source, templateContext)
        if (source.transformJs) {
          this.logger.debug(`Applying transform.js to data source: ${source.name}`)
          rawData = this.transformer.transform(source.transformJs, rawData)
        }
        return rawData
      }),
    )

    const data: Record<string, unknown> = {}
    results.forEach((result, index) => {
      const name = dataSources[index].name
      if (result.status === 'fulfilled') {
        data[name] = result.value
      }
      else {
        const message = getErrorMessage(result.reason)
        this.logger.warn(`Data source "${name}" failed: ${message}`)
        data[name] = { error: true, message }
      }
    })

    return data
  }
}
