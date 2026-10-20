import type { OAuthSettings, StoredAccessToken } from '../plugin-oauth.js'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PluginDataSource } from '../entities/plugin-data-source.entity.js'
import { isDueForRefresh, refreshCredentialsOf, refreshedTokenOf, refreshRequestOf } from '../plugin-oauth.js'
import { HttpStatusError, PluginDataFetcherService } from './plugin-data-fetcher.service.js'

/** What a poll of an OAuth Plugin's Data Source is signed with: the Recipe's settings and the Plugin's Field Values, secrets included. */
export interface OAuthPoll {
  settings: OAuthSettings
  fieldValues: Record<string, string>
}

const TOKEN_REQUEST_TIMEOUT_MS = 10_000
const REPLY_LIMIT = 500

const NO_TOKEN: StoredAccessToken = { accessToken: null, refreshToken: null, expiresAt: null, refreshedAt: null }

const isUnauthorized = (error: unknown): boolean => error instanceof HttpStatusError && error.status === 401

/**
 * The access token an OAuth Recipe's Data Source polls with (ADR-0067): the one its last refresh answered, or the
 * pasted one until a refresh happens. It is refreshed before a poll when it is due, and once more when the poll
 * answers 401. What a refresh answers is runtime state on the Data Source, never written into a Field Value.
 */
@Injectable()
export class PluginOAuthService {
  constructor(
    @InjectRepository(PluginDataSource)
    private readonly dataSourceRepository: Repository<PluginDataSource>,
    private readonly dataFetcher: PluginDataFetcherService,
  ) {}

  /** `poll` run with the access token, and run once more with a refreshed one if it is refused with a 401. A refresh that fails throws. */
  async withAccessToken<T>(source: { id?: string }, oauth: OAuthPoll, poll: (accessToken: string) => Promise<T>): Promise<T> {
    const stored = await this.load(source.id)
    const canRefresh = refreshCredentialsOf(oauth.fieldValues, stored) !== null
    const token = canRefresh && isDueForRefresh(stored, new Date())
      ? await this.refresh(source.id, oauth, stored)
      : stored
    try {
      return await poll(token.accessToken ?? oauth.fieldValues.oauth_access_token ?? '')
    }
    catch (error) {
      if (!isUnauthorized(error))
        throw error
      const refreshed = await this.refresh(source.id, oauth, token)
      return poll(refreshed.accessToken ?? '')
    }
  }

  private async load(id: string | undefined): Promise<StoredAccessToken> {
    const row = id ? await this.dataSourceRepository.findOne({ where: { id }, select: { id: true, oauthAccessToken: true, oauthRefreshToken: true, oauthAccessTokenExpiresAt: true, oauthRefreshedAt: true } }) : null
    if (!row)
      return NO_TOKEN
    return { accessToken: row.oauthAccessToken ?? null, refreshToken: row.oauthRefreshToken ?? null, expiresAt: row.oauthAccessTokenExpiresAt ?? null, refreshedAt: row.oauthRefreshedAt ?? null }
  }

  private async refresh(id: string | undefined, { settings, fieldValues }: OAuthPoll, stored: StoredAccessToken): Promise<StoredAccessToken> {
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
    if (id)
      await this.dataSourceRepository.update(id, { oauthAccessToken: token.accessToken, oauthRefreshToken: token.refreshToken, oauthAccessTokenExpiresAt: token.expiresAt, oauthRefreshedAt: token.refreshedAt })
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
