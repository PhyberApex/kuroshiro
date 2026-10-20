import { isPlainObject } from '../utils/json.js'

/** A Recipe's `oauth_*` settings as its settings.yml wrote them, `oauth_enabled` included (ADR-0067). */
export type OAuthSettings = Record<string, string>

/** The Plugin Fields an OAuth Recipe is given on import, which hold what the admin pastes from an OAuth dance done elsewhere. */
export const OAUTH_FIELDS = [
  { keyname: 'oauth_access_token', name: 'OAuth access token', description: 'Pasted from an OAuth dance done elsewhere. Kuroshiro refreshes it with the refresh token.' },
  { keyname: 'oauth_refresh_token', name: 'OAuth refresh token', description: 'Lets Kuroshiro get a new access token when the one it has runs out.' },
  { keyname: 'oauth_client_id', name: 'OAuth client id', description: 'The client the tokens were issued to.' },
  { keyname: 'oauth_client_secret', name: 'OAuth client secret', description: 'The secret of that client.' },
] as const

const ACCESS_TOKEN = 'oauth_access_token'

export const isOAuthKeyname = (keyname: string): boolean => OAUTH_FIELDS.some(field => field.keyname === keyname)

/** A flag of a Recipe's settings, which TRMNL's archives quote as 'true' / 'false' or 'yes' / 'no'. */
export function settingFlag(value: unknown): boolean {
  return typeof value === 'string' ? ['true', 'yes'].includes(value.trim().toLowerCase()) : value === true
}

/** The `oauth_*` keys of settings that sign in with OAuth, each as text; none for settings that do not. */
export function oauthSettingsOf(settings: object): OAuthSettings | undefined {
  const entries = Object.entries(settings).filter(([key]) => key.startsWith('oauth_'))
  if (!settingFlag((settings as { oauth_enabled?: unknown }).oauth_enabled))
    return undefined
  return Object.fromEntries(entries.map(([key, value]) => [key, value === null || value === undefined ? '' : String(value)]))
}

/** The access token a Data Source last refreshed, and when; all `null` until it refreshes one. */
export interface StoredAccessToken {
  accessToken: string | null
  refreshToken: string | null
  expiresAt: Date | null
  refreshedAt: Date | null
}

/** A Data Source's refreshed token forgotten, as a save that pastes a token again leaves it, so the next poll starts from what was pasted. */
export const NO_REFRESHED_TOKEN = { oauthAccessToken: null, oauthRefreshToken: null, oauthAccessTokenExpiresAt: null, oauthRefreshedAt: null }

const EXPIRY_MARGIN_MS = 60_000
const UNKNOWN_EXPIRY_AGE_MS = 50 * 60_000

/** Within sixty seconds of its expiry, or, its expiry unknown, last refreshed over fifty minutes ago or never. */
export function isDueForRefresh(token: StoredAccessToken, now: Date): boolean {
  if (token.expiresAt)
    return token.expiresAt.getTime() - now.getTime() <= EXPIRY_MARGIN_MS
  return !token.refreshedAt || now.getTime() - token.refreshedAt.getTime() > UNKNOWN_EXPIRY_AGE_MS
}

/** What a refresh grant is sent with: the pasted refresh token, or the one the last refresh answered in its place. */
export interface RefreshCredentials {
  refreshToken: string
  clientId: string
  clientSecret: string
}

/** The credentials of a refresh from the Field Values and the stored token, or `null` while any is missing. */
export function refreshCredentialsOf(fieldValues: Record<string, string>, stored: StoredAccessToken): RefreshCredentials | null {
  const refreshToken = stored.refreshToken || fieldValues.oauth_refresh_token
  const clientId = fieldValues.oauth_client_id
  const clientSecret = fieldValues.oauth_client_secret
  return refreshToken && clientId && clientSecret ? { refreshToken, clientId, clientSecret } : null
}

function refreshParamsOf(settings: OAuthSettings): Record<string, string> {
  const raw = settings.oauth_refresh_params?.trim()
  if (!raw)
    return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    return isPlainObject(parsed) ? Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)])) : {}
  }
  catch {
    return Object.fromEntries(new URLSearchParams(raw))
  }
}

/** The refresh grant: a POST to the Recipe's refresh or token URL, in its body format, form-encoded unless it says JSON. */
export function refreshRequestOf(settings: OAuthSettings, credentials: RefreshCredentials): { url: string, init: RequestInit } {
  const params = {
    grant_type: 'refresh_token',
    refresh_token: credentials.refreshToken,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    ...refreshParamsOf(settings),
  }
  const url = settings.oauth_refresh_url?.trim() || settings.oauth_token_url?.trim() || ''
  const json = settings.oauth_body_format?.trim().toLowerCase() === 'json'
  return {
    url,
    init: {
      method: 'POST',
      headers: { 'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: json ? JSON.stringify(params) : new URLSearchParams(params).toString(),
    },
  }
}

const validDate = (at: Date): Date | null => Number.isNaN(at.getTime()) ? null : at

/** A moment as epoch seconds, epoch milliseconds or ISO text. */
function momentOf(value: unknown): Date | null {
  if (typeof value === 'number')
    return validDate(new Date(value < 1e12 ? value * 1000 : value))
  return typeof value === 'string' ? validDate(new Date(value)) : null
}

/** A number of seconds from `now`, written as a number or as text. */
function secondsFrom(now: Date, value: unknown): Date | null {
  const seconds = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '') ? Number(value) : Number.NaN
  return Number.isFinite(seconds) ? new Date(now.getTime() + seconds * 1000) : null
}

const ABSOLUTE_EXPIRY = ['expires_at', 'absolute']

/** The expiry by the Recipe's strategy: its fixed lifetime, a moment the answer names, or by default seconds from now. */
function expiresAtOf(settings: OAuthSettings, response: Record<string, unknown>, now: Date): Date | null {
  const strategy = settings.oauth_expiry_strategy?.trim().toLowerCase() ?? ''
  if (strategy === 'fixed')
    return secondsFrom(now, Number(settings.oauth_fixed_expiry_ms) / 1000)
  const value = response[settings.oauth_expiry_field_name?.trim() || 'expires_in']
  return ABSOLUTE_EXPIRY.includes(strategy) ? momentOf(value) : secondsFrom(now, value)
}

/** The token endpoint's answer read as a stored token, or `null` when it names no access token. */
export function refreshedTokenOf(settings: OAuthSettings, response: unknown, now: Date): StoredAccessToken | null {
  if (!isPlainObject(response))
    return null
  const accessToken = response[settings.oauth_token_field_name?.trim() || 'access_token']
  if (typeof accessToken !== 'string' || accessToken === '')
    return null
  const refreshToken = typeof response.refresh_token === 'string' && response.refresh_token !== '' ? response.refresh_token : null
  return { accessToken, refreshToken, expiresAt: expiresAtOf(settings, response, now), refreshedAt: now }
}

/** The context with the access token in place of the pasted one, in both places a Field Value is read. */
export function withAccessToken(context: object, accessToken: string): Record<string, unknown> {
  const trmnl = (context as { trmnl?: { plugin_settings?: { custom_fields_values?: object } } }).trmnl
  const pluginSettings = trmnl?.plugin_settings
  return {
    ...context,
    [ACCESS_TOKEN]: accessToken,
    ...(trmnl && { trmnl: { ...trmnl, plugin_settings: { ...pluginSettings, custom_fields_values: { ...pluginSettings?.custom_fields_values, [ACCESS_TOKEN]: accessToken } } } }),
  }
}
