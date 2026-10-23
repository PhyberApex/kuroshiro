import type { JsonObject } from '../../utils/json.js'
import type { FetchableDataSource, FetchErrorMarker, FetchOptions } from './plugin-data-fetcher.service.js'
import type { OAuthPoll } from './plugin-oauth.service.js'
import { Injectable, Logger, Optional } from '@nestjs/common'
import { hideSecretsIn } from '../plugin-field-values.js'
import { contextWithAccessToken } from '../plugin-oauth.js'
import { isUnauthorized, PluginDataFetcherService } from './plugin-data-fetcher.service.js'
import { PluginOAuthService } from './plugin-oauth.service.js'
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
  /** Each stored Data Source's Previous Output by id (ADR-0070). */
  previousOutputs?: Record<string, JsonObject>
  /** Set for a Plugin imported from an OAuth Recipe: each fetch-mode Data Source polls with the Plugin's access token (ADR-0068). */
  oauth?: OAuthPoll
}

/** The context with the Data Source's saved state at `trmnl.state`, for its request and its transform alike. */
function withState(templateContext: object, state: JsonObject): Record<string, unknown> {
  const trmnl = (templateContext as { trmnl?: object }).trmnl ?? {}
  return { ...templateContext, trmnl: { ...trmnl, state } }
}

/** The transform's context, which alone reads the Previous Output at `trmnl.previous_merge_variables`, as trmnlp hands it (ADR-0070). */
function withPreviousOutput(context: object, previousOutput: JsonObject): Record<string, unknown> {
  const trmnl = (context as { trmnl?: object }).trmnl ?? {}
  return { ...context, trmnl: { ...trmnl, previous_merge_variables: previousOutput } }
}

export type { FetchErrorMarker } from './plugin-data-fetcher.service.js'

/** What a Template reads in place of the data of a Data Source that failed (ADR-0005). */
export function isFetchErrorMarker(value: unknown): value is FetchErrorMarker {
  return typeof value === 'object' && value !== null && (value as { error?: unknown }).error === true
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * What a lone Data Source lays at the root of the context besides its own
 * name, as TRMNL lays one polling URL's response (ADR-0049): its keys when it
 * resolved to an object, the value as `data` when it resolved to a list or
 * text (ADR-0058), and nothing for an empty body, an error marker or a Plugin
 * with two or more Data Sources.
 */
export function loneSourceRootKeys(sourceData: Record<string, unknown>): Record<string, unknown> {
  const results = Object.values(sourceData)
  const [only] = results
  if (results.length !== 1 || only === null || only === undefined || isFetchErrorMarker(only))
    return {}
  return isPlainRecord(only) ? only : { data: only }
}

/**
 * What a transform receives, as TRMNL's serverless `run(input)` does: the template context (`trmnl`, the Field Values,
 * `sensors`) with the fetched object laid over it, or anything else fetched (a list, text, nothing) under `data`.
 */
export function transformInputOf(fetched: unknown, templateContext: object = {}): Record<string, unknown> {
  return isPlainRecord(fetched) ? { ...templateContext, ...fetched } : { ...templateContext, data: fetched }
}

/**
 * What a Data Source polled with an OAuth access token answers, or the error it fails with, with that token hidden: a
 * refreshed token is no Field Value, so the password hiding downstream never knows it. A 401 passes through untouched,
 * so it can still be told apart and retried.
 */
async function hidingAccessToken(accessToken: string, resolving: Promise<unknown>): Promise<unknown> {
  const secrets = [accessToken].filter(Boolean)
  try {
    return hideSecretsIn(await resolving, secrets)
  }
  catch (error) {
    if (isUnauthorized(error))
      throw error
    throw new Error(hideSecretsIn(error instanceof Error ? error.message : String(error), secrets))
  }
}

@Injectable()
export class PluginDataResolverService {
  private readonly logger = new Logger(PluginDataResolverService.name)

  constructor(
    private readonly dataFetcher: PluginDataFetcherService,
    private readonly transformer: PluginTransformService,
    @Optional() private readonly oauthTokens?: PluginOAuthService,
  ) {}

  /**
   * Fetches every Data Source in parallel and applies its transform.js if
   * set. A source that fails gets an error marker instead of aborting the
   * whole call (ADR-0005) — every render/mashup/preview path that turns a
   * Plugin's (or a preview's) Data Sources into template data should go
   * through this rather than re-deriving the fetch/transform/error-marker
   * logic itself.
   */
  async resolveAll(dataSources: ResolvableDataSource[], templateContext: object = {}, { savedStates = {}, previousOutputs = {}, oauth }: ResolveOptions = {}): Promise<Record<string, unknown>> {
    const results = await Promise.allSettled(
      dataSources.map(async (source) => {
        const context = withState(templateContext, (source.id && savedStates[source.id]) || {})
        const previousOutput = (source.id && previousOutputs[source.id]) || {}
        if (!oauth || !this.oauthTokens || source.mode === 'literal')
          return this.resolveOne(source, context, previousOutput)
        return this.oauthTokens.withAccessToken(oauth, (accessToken, lastTry) => hidingAccessToken(accessToken, this.resolveOne(source, contextWithAccessToken(context, accessToken), previousOutput, { unauthorizedThrows: !lastTry })))
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

  private async resolveOne(source: ResolvableDataSource, context: object, previousOutput: JsonObject, fetchOptions?: FetchOptions): Promise<unknown> {
    const rawData = await this.dataFetcher.fetchOrLiteral(source, context, fetchOptions)
    if (!source.transformJs)
      return rawData
    this.logger.debug(`Applying transform.js to data source: ${source.name}`)
    const fetchForTransform = (url: string, init?: RequestInit) => this.dataFetcher.fetchForTransform(url, init)
    return this.transformer.transform(source.transformJs, transformInputOf(rawData, withPreviousOutput(context, previousOutput)), { fetch: fetchForTransform })
  }
}
