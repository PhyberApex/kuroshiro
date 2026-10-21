import type { DataSourceLiteralValue, DataSourceMode } from 'kuroshiro-shared'
import type { JsonObject, JsonValue } from '../../utils/json.js'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InstanceTimeZone } from '../../instance/instance-time-zone.js'
import { isPlainObject } from '../../utils/json.js'
import { assertPublicUrl } from '../../utils/ssrfGuard.js'
import { PluginRendererService } from './plugin-renderer.service.js'
import { parseResponseBody } from './response-body.js'

// The subset of a Data Source's fields fetchOrLiteral needs — shared by the
// PluginDataSource entity and PreviewDataSourceDto, which carry the same fields
// under slightly different types.
/** What a Template reads in place of the data of a request that failed (ADR-0005). */
export interface FetchErrorMarker {
  error: true
  message: string
}

export interface FetchableDataSource {
  mode?: DataSourceMode
  method?: string
  url?: string | null
  headers?: Record<string, string> | null
  body?: JsonObject | null
  literalValue?: DataSourceLiteralValue
}

/**
 * The addresses a Data Source's rendered URL names, one per line as TRMNL reads a Polling URL (ADR-0058): line breaks of
 * either kind split it, each line's inner whitespace collapses, blank lines are dropped.
 */
export function pollingUrlsOf(rendered: string): string[] {
  return rendered.split(/\r\n|\r|\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(line => line !== '')
}

/** A response that was not a success, with its status, so a caller can tell a refused token (401) from the rest. */
export class HttpStatusError extends Error {
  constructor(readonly status: number) {
    super(`HTTP error! status: ${status}`)
  }
}

export interface FetchOptions {
  /** A line of a multi-line Polling URL answered 401 fails the whole fetch rather than reading as that line's error marker, so an OAuth poll can refresh its token and retry (ADR-0067). */
  unauthorizedThrows?: boolean
}

/** A response refused with a 401, as a revoked or expired OAuth access token is. */
export const isUnauthorized = (reason: unknown): boolean => reason instanceof HttpStatusError && reason.status === 401

/** How long TRMNL gives a polled host to answer (ADR-0062). */
const REQUEST_TIMEOUT_MS = 10_000

/** The request as given, given up when the host has not answered within TRMNL's time. */
async function fetchWithinTimeout(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  }
  catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError')
      throw new Error(`The host did not answer within ${REQUEST_TIMEOUT_MS / 1000} seconds.`)
    throw error
  }
}

/** What a line that failed reads as, next to the lines that did not (ADR-0005). */
function errorMarkerOf(reason: unknown): FetchErrorMarker {
  return { error: true, message: reason instanceof Error ? reason.message : String(reason) }
}

/** One line's response as TRMNL lays it at `IDX_n`: a list or text under `data`, an object as it is (ADR-0061). */
function lineDataOf(value: unknown): unknown {
  return Array.isArray(value) || typeof value === 'string' ? { data: value } : value
}

@Injectable()
export class PluginDataFetcherService {
  constructor(
    private readonly renderer: PluginRendererService,
    private readonly configService: ConfigService,
    private readonly instanceTimeZone: InstanceTimeZone,
  ) {}

  /**
   * Resolves one Data Source's value regardless of mode: a literal-mode
   * source contributes its stored value directly, with no network call at
   * all; a fetch-mode source is fetched as usual. Every render/schedule/
   * preview path that iterates a Plugin's Data Sources should go through
   * this rather than re-deriving the mode branch itself.
   */
  async fetchOrLiteral(source: FetchableDataSource, templateContext?: object, options?: FetchOptions): Promise<unknown> {
    if (source.mode === 'literal') {
      return source.literalValue ?? null
    }
    return this.fetchData(source.method || 'GET', source.url || '', source.headers ?? undefined, source.body ?? undefined, templateContext, options)
  }

  async fetchData(
    method: string,
    url: string,
    headers: Record<string, string> = {},
    body?: JsonObject,
    templateContext?: object,
    { unauthorizedThrows = false }: FetchOptions = {},
  ): Promise<unknown> {
    const context = templateContext ?? {}
    const urls = pollingUrlsOf(await this.renderLiquid(url, context))
    const resolvedHeaders = await this.renderLiquidDeep(headers, context) as Record<string, string>
    const resolvedBody = body && await this.renderLiquidDeep(body, context) as JsonObject
    const init = this.buildRequestInit(method, resolvedHeaders, resolvedBody)

    if (urls.length <= 1)
      return this.fetchOne(urls[0] ?? '', init)

    const responses = await Promise.allSettled(urls.map(line => this.fetchOne(line, init)))
    const refused = unauthorizedThrows && responses.find(response => response.status === 'rejected' && isUnauthorized(response.reason))
    if (refused)
      throw (refused as PromiseRejectedResult).reason
    return Object.fromEntries(responses.map((response, index) => [`IDX_${index}`, response.status === 'fulfilled' ? lineDataOf(response.value) : errorMarkerOf(response.reason)]))
  }

  private async fetchOne(url: string, init: RequestInit): Promise<unknown> {
    if (this.configService.get<boolean>('demo_mode'))
      assertPublicUrl(url)
    return this.parseResponse(await fetchWithinTimeout(url, init))
  }

  /** The `fetch` a transform calls (ADR-0052): the request as given, refused for an internal host in demo mode like a Data Source URL. */
  async fetchForTransform(url: string, init?: RequestInit): Promise<Response> {
    if (this.configService.get<boolean>('demo_mode'))
      assertPublicUrl(url)
    return fetch(url, init)
  }

  // The rendered result is never logged: a Field Value placed in a url or a header can be a secret.
  private async renderLiquid(text: string, context: object): Promise<string> {
    if (!text.includes('{{') && !text.includes('{%'))
      return text
    return this.renderer.render(text, context)
  }

  private async renderLiquidDeep(value: JsonValue, context: object): Promise<JsonValue> {
    if (typeof value === 'string')
      return this.renderLiquid(value, context)
    if (Array.isArray(value))
      return Promise.all(value.map(item => this.renderLiquidDeep(item, context)))
    if (isPlainObject(value)) {
      const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await this.renderLiquidDeep(item as JsonValue, context)] as const))
      return Object.fromEntries(entries)
    }
    return value
  }

  private buildRequestInit(method: string, headers: Record<string, string>, body?: JsonObject): RequestInit {
    const options: RequestInit = {
      method,
      headers: method === 'POST' && body
        ? { 'Content-Type': 'application/json', ...headers }
        : headers,
    }
    if (method === 'POST' && body)
      options.body = JSON.stringify(body)
    return options
  }

  /** The body read as TRMNL reads it (ADR-0059): JSON, an XML feed as an object, CSV rows, an iCalendar feed's events (ADR-0066), or the text. */
  private async parseResponse(response: Response): Promise<unknown> {
    if (!response.ok)
      throw new HttpStatusError(response.status)
    return parseResponseBody(await response.text(), response.headers.get('content-type'), { timeZone: this.instanceTimeZone.name, now: new Date() })
  }
}
