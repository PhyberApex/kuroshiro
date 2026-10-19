import type { FetchableDataSource } from './plugin-data-fetcher.service.js'
import { Injectable, Logger } from '@nestjs/common'
import { PluginDataFetcherService } from './plugin-data-fetcher.service.js'
import { PluginTransformService } from './plugin-transform.service.js'

// The subset of a Data Source's fields resolveAll needs — shared by the
// PluginDataSource entity and PreviewDataSourceDto, which carry the same fields
// under slightly different types.
export interface ResolvableDataSource extends FetchableDataSource {
  name: string
  transformJs?: string | null
}

export interface FetchErrorMarker {
  error: true
  message: string
}

/** What a Template reads in place of the data of a Data Source that failed (ADR-0005). */
export function isFetchErrorMarker(value: unknown): value is FetchErrorMarker {
  return typeof value === 'object' && value !== null && (value as { error?: unknown }).error === true
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * What a lone Data Source lays at the root of the context besides its own
 * name, as TRMNL lays one polling URL's response (ADR-0049): its keys when it
 * resolved to an object, and nothing for a list, a scalar, an error marker or
 * a Plugin with two or more Data Sources.
 */
export function loneSourceRootKeys(sourceData: Record<string, unknown>): Record<string, unknown> {
  const results = Object.values(sourceData)
  const [only] = results
  return results.length === 1 && isPlainRecord(only) && !isFetchErrorMarker(only) ? only : {}
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
   * Plugin's (or a preview's) Data Sources into template data should go
   * through this rather than re-deriving the fetch/transform/error-marker
   * logic itself.
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
        const message = result.reason?.message || String(result.reason)
        // Never logged: the message can quote a password Field Value, same as the resolved
        // URL/headers/body renderLiquid refuses to log (PluginDataFetcherService.renderLiquid).
        this.logger.warn(`Data source "${name}" failed`)
        data[name] = { error: true, message }
      }
    })

    return data
  }
}
