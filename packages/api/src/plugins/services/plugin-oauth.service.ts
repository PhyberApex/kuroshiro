import type { OAuthSettings, StoredAccessToken } from '../plugin-oauth.js'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Plugin } from '../entities/plugin.entity.js'
import { isDueForRefresh, refreshCredentialsOf, refreshedTokenOf, refreshRequestOf } from '../plugin-oauth.js'
import { HttpStatusError, PluginDataFetcherService } from './plugin-data-fetcher.service.js'

/** What a poll of an OAuth Plugin's Data Source is signed with: the Plugin, the Recipe's settings and its Field Values, secrets included. */
export interface OAuthPoll {
  /** Unset for a preview of a Plugin not saved yet, whose refreshed token is kept nowhere. */
  pluginId?: string
  settings: OAuthSettings
  fieldValues: Record<string, string>
}

const TOKEN_REQUEST_TIMEOUT_MS = 10_000
const REPLY_LIMIT = 500

const NO_TOKEN: StoredAccessToken = { accessToken: null, refreshToken: null, expiresAt: null, refreshedAt: null }

const isUnauthorized = (error: unknown): boolean => error instanceof HttpStatusError && error.status === 401

/**
 * The access token an OAuth Recipe's Data Sources poll with (ADR-0067): the one the Plugin's last refresh answered, or
 * the pasted one until a refresh happens. It is refreshed before a poll when it is due, and once more when the poll
 * answers 401. What a refresh answers is runtime state on the Plugin, read by every one of its Data Sources and never
 * written into a Field Value. Reading and refreshing it is one Plugin at a time, so two Data Sources polling together
 * refresh once and never send a refresh token a rotating provider has already spent.
 */
@Injectable()
export class PluginOAuthService {
  private readonly locks = new Map<string, Promise<unknown>>()

  constructor(
    @InjectRepository(Plugin)
    private readonly pluginRepository: Repository<Plugin>,
    private readonly dataFetcher: PluginDataFetcherService,
  ) {}

  /**
   * `poll` run with the access token, and run once more with a refreshed one if it is refused with a 401. `lastTry`
   * tells the retry from the first poll. A refresh that fails throws.
   */
  async withAccessToken<T>(oauth: OAuthPoll, poll: (accessToken: string, lastTry: boolean) => Promise<T>): Promise<T> {
    const token = await this.oneAtATime(oauth.pluginId, async () => {
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
      const refreshed = await this.oneAtATime(oauth.pluginId, async () => {
        const stored = await this.load(oauth.pluginId)
        // Another Data Source refreshed it since this poll took its token.
        if (stored.accessToken && stored.accessToken !== token.accessToken)
          return stored
        return this.refresh(oauth, stored)
      })
      return poll(refreshed.accessToken ?? '', true)
    }
  }

  /** `work` run once the Plugin's earlier work has settled. */
  private async oneAtATime<T>(pluginId: string | undefined, work: () => Promise<T>): Promise<T> {
    if (!pluginId)
      return work()
    const current = (this.locks.get(pluginId) ?? Promise.resolve()).then(work)
    const settled = current.catch(() => {})
    this.locks.set(pluginId, settled)
    try {
      return await current
    }
    finally {
      if (this.locks.get(pluginId) === settled)
        this.locks.delete(pluginId)
    }
  }

  private async load(pluginId: string | undefined): Promise<StoredAccessToken> {
    const row = pluginId ? await this.pluginRepository.findOne({ where: { id: pluginId }, select: { id: true, oauthAccessToken: true, oauthRefreshToken: true, oauthAccessTokenExpiresAt: true, oauthRefreshedAt: true } }) : null
    if (!row)
      return NO_TOKEN
    return { accessToken: row.oauthAccessToken ?? null, refreshToken: row.oauthRefreshToken ?? null, expiresAt: row.oauthAccessTokenExpiresAt ?? null, refreshedAt: row.oauthRefreshedAt ?? null }
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
    if (!refreshed)
      throw new Error(`The token endpoint answered no access token: ${reply.slice(0, REPLY_LIMIT)}`)
    const token = { ...refreshed, refreshToken: refreshed.refreshToken ?? stored.refreshToken }
    if (pluginId)
      await this.pluginRepository.update(pluginId, { oauthAccessToken: token.accessToken, oauthRefreshToken: token.refreshToken, oauthAccessTokenExpiresAt: token.expiresAt, oauthRefreshedAt: token.refreshedAt })
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
