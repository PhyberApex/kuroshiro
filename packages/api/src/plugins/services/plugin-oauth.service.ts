import type { OAuthSettings, StoredAccessToken } from '../plugin-oauth.js'
import { isDeepStrictEqual } from 'node:util'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OneAtATime } from '../../utils/oneAtATime.js'
import { Plugin } from '../entities/plugin.entity.js'
import { accessTokenFieldOf, columnsOf, isDueForRefresh, NO_STORED_TOKEN, pastedTokensOf, refreshCredentialsOf, refreshedTokenOf, refreshRequestOf, STORED_TOKEN_SELECT, storedAccessTokenOf } from '../plugin-oauth.js'
import { isUnauthorized, PluginDataFetcherService } from './plugin-data-fetcher.service.js'
import { PluginFieldValuesService } from './plugin-field-values.service.js'

/** What a poll of an OAuth Plugin's Data Source is signed with: the Plugin, the Recipe's settings and its Field Values, secrets included. */
export interface OAuthPoll {
  /** Unset for a preview of a Plugin not saved yet, or of tokens not saved yet, whose refreshed token is kept nowhere. */
  pluginId?: string
  settings: OAuthSettings
  fieldValues: Record<string, string>
}

const TOKEN_REQUEST_TIMEOUT_MS = 10_000
const REPLY_LIMIT = 500

/**
 * The access token an OAuth Recipe's Data Sources poll with (ADR-0068): the one the Plugin's last refresh answered, or
 * the pasted one until a refresh happens. It is refreshed before a poll when it is due, and once more when the poll
 * answers 401. What a refresh answers is runtime state on the Plugin, read by every one of its Data Sources and never
 * written into a Field Value. Reading and refreshing it is one Plugin at a time, so two Data Sources polling together
 * refresh once and never send a refresh token a rotating provider has already spent.
 */
@Injectable()
export class PluginOAuthService {
  private readonly perPlugin = new OneAtATime()

  constructor(
    @InjectRepository(Plugin)
    private readonly pluginRepository: Repository<Plugin>,
    private readonly dataFetcher: PluginDataFetcherService,
    private readonly fieldValues: PluginFieldValuesService,
  ) {}

  /**
   * `poll` run with the access token, and run once more with a refreshed one if it is refused with a 401. `lastTry`
   * tells the retry from the first poll. A refresh that fails throws.
   */
  async withAccessToken<T>(oauth: OAuthPoll, poll: (accessToken: string, lastTry: boolean) => Promise<T>): Promise<T> {
    const token = await this.perPlugin.run(oauth.pluginId, async () => {
      const stored = await this.load(oauth.pluginId)
      const canRefresh = refreshCredentialsOf(oauth.fieldValues, stored) !== null
      return canRefresh && isDueForRefresh(stored, new Date()) ? this.refresh(oauth, stored) : stored
    })
    try {
      return await poll(token.accessToken ?? oauth.fieldValues.oauth_access_token ?? '', false)
    }
    catch (error) {
      if (!isUnauthorized(error))
        throw error
      const refreshed = await this.perPlugin.run(oauth.pluginId, async () => {
        const stored = await this.load(oauth.pluginId)
        // Another Data Source refreshed it since this poll took its token.
        if (stored.accessToken && stored.accessToken !== token.accessToken)
          return stored
        return this.refresh(oauth, stored)
      })
      return poll(refreshed.accessToken ?? '', true)
    }
  }

  private async load(pluginId: string | undefined): Promise<StoredAccessToken> {
    const row = pluginId ? await this.pluginRepository.findOne({ where: { id: pluginId }, select: STORED_TOKEN_SELECT }) : null
    return row ? storedAccessTokenOf(row) : NO_STORED_TOKEN
  }

  /**
   * Whether the Plugin still has the settings and pasted tokens a refresh was sent with. A save that changes them while
   * the refresh runs forgets the refreshed token, and what the refresh answers must not bring back one issued for the
   * old ones.
   */
  private async stillPasted(pluginId: string, { settings, fieldValues }: OAuthPoll): Promise<boolean> {
    const [plugin, stored] = await Promise.all([
      this.pluginRepository.findOne({ where: { id: pluginId }, select: { id: true, oauthSettings: true } }),
      this.fieldValues.storedFor(pluginId),
    ])
    return !!plugin && isDeepStrictEqual(plugin.oauthSettings, settings) && isDeepStrictEqual(pastedTokensOf(stored), pastedTokensOf(fieldValues))
  }

  private async refresh({ pluginId, settings, fieldValues }: OAuthPoll, stored: StoredAccessToken): Promise<StoredAccessToken> {
    const credentials = refreshCredentialsOf(fieldValues, stored)
    if (!credentials)
      throw new Error('The access token was refused, and there is no refresh token, client id and client secret to refresh it with.')

    const { url, init } = refreshRequestOf(settings, credentials)
    if (!url)
      throw new Error('The Recipe names no token URL to refresh the access token at.')
    const response = await this.dataFetcher.fetchForTransform(url, { ...init, signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS) })
    const reply = await response.text()
    if (!response.ok)
      throw new Error(`The token endpoint answered ${response.status}: ${reply.slice(0, REPLY_LIMIT)}`)

    const refreshed = refreshedTokenOf(settings, tryParseJson(reply), new Date())
    // A successful answer is not quoted: it holds the tokens.
    if (!refreshed)
      throw new Error(`The token endpoint answered no "${accessTokenFieldOf(settings)}" field.`)
    const token = { ...refreshed, refreshToken: refreshed.refreshToken ?? stored.refreshToken }
    if (pluginId && await this.stillPasted(pluginId, { pluginId, settings, fieldValues }))
      await this.pluginRepository.update(pluginId, columnsOf(token))
    return token
  }
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  }
  catch {
    return null
  }
}
