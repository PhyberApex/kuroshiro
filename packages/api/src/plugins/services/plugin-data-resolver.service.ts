import type { JsonObject } from '../../utils/json.js'
import type { FetchableDataSource } from './plugin-data-fetcher.service.js'
import { Injectable, Logger } from '@nestjs/common'
import { PluginDataFetcherService } from './plugin-data-fetcher.service.js'
import { PluginTransformService } from './plugin-transform.service.js'

// The subset of a Data Source's fields resolveAll needs — shared by the
// PluginDataSource entity and PreviewDataSourceDto, which carry the same fields
// under slightly different types.
export interface ResolvableDataSource extends FetchableDataSource {
  /** Absent for a Data Source the preview holds unsaved; its saved state is then empty. */
  id?: string
  name: string
  transformJs?: string | null
}

export interface ResolveOptions {
  /** Each stored Data Source's saved state by id (ADR-0052). */
  savedStates?: Record<string, JsonObject>
}

/** The context with the Data Source's saved state at `trmnl.state`, for its request and its transform alike. */
function withState(templateContext: object, state: JsonObject): Record<string, unknown> {
  const trmnl = (templateContext as { trmnl?: object }).trmnl ?? {}
  return { ...templateContext, trmnl: { ...trmnl, state } }
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

/**
 * What a transform receives, as TRMNL's serverless `run(input)` does: the template context (`trmnl`, the Field Values,
 * `sensors`) with the fetched object laid over it, or anything else fetched (a list, text, nothing) under `data`.
 */
export function transformInputOf(fetched: unknown, templateContext: object = {}): Record<string, unknown> {
  return isPlainRecord(fetched) ? { ...templateContext, ...fetched } : { ...templateContext, data: fetched }
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
  async resolveAll(dataSources: ResolvableDataSource[], templateContext: object = {}, { savedStates = {} }: ResolveOptions = {}): Promise<Record<string, unknown>> {
    const fetchForTransform = (url: string, init?: RequestInit) => this.dataFetcher.fetchForTransform(url, init)
    const results = await Promise.allSettled(
      dataSources.map(async (source) => {
        const context = withState(templateContext, (source.id && savedStates[source.id]) || {})
        const rawData = await this.dataFetcher.fetchOrLiteral(source, context)
        if (!source.transformJs)
          return rawData
        this.logger.debug(`Applying transform.js to data source: ${source.name}`)
        return this.transformer.transform(source.transformJs, transformInputOf(rawData, context), { fetch: fetchForTransform })
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
