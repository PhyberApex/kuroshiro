import type { ConfigService } from '@nestjs/config'
import type { DataSource } from 'typeorm'
import type { OAuthSettings } from '../plugin-oauth.js'
import type { PluginRenderCacheService } from '../services/plugin-render-cache.service.js'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { InstanceTimeZone } from '../../instance/instance-time-zone.js'
import { jsonResponse, stubFetch } from '../../test/fetch.js'
import { asService } from '../../test/mockService.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { PluginDataSource } from '../entities/plugin-data-source.entity.js'
import { PluginFieldValue } from '../entities/plugin-field-value.entity.js'
import { PluginField } from '../entities/plugin-field.entity.js'
import { Plugin } from '../entities/plugin.entity.js'
import { OAUTH_FIELDS } from '../plugin-oauth.js'
import { DataSourceFetchOutcomeService } from '../services/data-source-fetch-outcome.service.js'
import { PluginDataFetcherService } from '../services/plugin-data-fetcher.service.js'
import { PluginDataResolverService } from '../services/plugin-data-resolver.service.js'
import { PluginDataSourceStateService } from '../services/plugin-data-source-state.service.js'
import { PluginFieldValuesService } from '../services/plugin-field-values.service.js'
import { PluginOAuthService } from '../services/plugin-oauth.service.js'
import { PluginRefreshService } from '../services/plugin-refresh.service.js'
import { PluginRendererService } from '../services/plugin-renderer.service.js'
import { PluginTemplateContextService } from '../services/plugin-template-context.service.js'
import { PluginTransformService } from '../services/plugin-transform.service.js'

const TOKEN_URL = 'https://oauth2.example.com/token'
const POLL_URL = 'https://api.example.com/report'
const NOW = new Date('2030-01-05T09:00:00Z')
const MINUTE = 60_000

const ADMOB_SETTINGS: OAuthSettings = { oauth_enabled: 'true', oauth_token_url: TOKEN_URL, oauth_refresh_params: '', oauth_expiry_field_name: '', oauth_expiry_strategy: '' }
const PASTED = { oauth_access_token: 'pasted-access', oauth_refresh_token: 'pasted-refresh', oauth_client_id: 'client', oauth_client_secret: 'secret' }

type Answer = (init: RequestInit) => Response | Promise<Response>

describe('an OAuth Plugin\'s access token, refreshed before a poll and on a 401 (ADR-0067)', () => {
  let database: DataSource
  let refresh: PluginRefreshService
  let templateContext: PluginTemplateContextService
  const fetchMock = stubFetch()
  let tokenEndpoint: Answer
  let pollEndpoint: Answer
  const pollAuthorizations: string[] = []
  const tokenRequests: string[] = []

  beforeAll(async () => {
    database = await createTestDatabase()
    const renderer = new PluginRendererService(new InstanceTimeZone())
    const fetcher = new PluginDataFetcherService(renderer, asService<ConfigService>({ get: () => false }))
    const dataSources = database.getRepository(PluginDataSource)
    const resolver = new PluginDataResolverService(fetcher, new PluginTransformService(), new PluginOAuthService(dataSources, fetcher))
    const fieldValues = new PluginFieldValuesService(database.getRepository(PluginFieldValue), database.getRepository(PluginField))
    templateContext = new PluginTemplateContextService(fieldValues, resolver, new InstanceTimeZone(), new PluginDataSourceStateService(dataSources))
    const renderCache = asService<PluginRenderCacheService>({ renderAndCache: async () => {} })
    refresh = new PluginRefreshService(renderCache, templateContext, new DataSourceFetchOutcomeService(dataSources), new PluginDataSourceStateService(dataSources), database.getRepository(Plugin))
  })

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    pollAuthorizations.length = 0
    tokenRequests.length = 0
    tokenEndpoint = () => jsonResponse({ access_token: 'refreshed-access', expires_in: 3599, token_type: 'Bearer' })
    pollEndpoint = () => jsonResponse({ rows: 3 })
    fetchMock.mockImplementation(async (input, init = {}) => {
      if (String(input) === TOKEN_URL) {
        tokenRequests.push(String(init.body))
        return tokenEndpoint(init)
      }
      pollAuthorizations.push(new Headers(init.headers).get('Authorization') ?? '')
      return pollEndpoint(init)
    })
  })

  afterEach(async () => {
    vi.useRealTimers()
    await database.query('TRUNCATE "plugin" CASCADE')
  })

  afterAll(async () => {
    await database.destroy()
  })

  async function oauthPlugin({ settings = ADMOB_SETTINGS, values = PASTED, token = {} }: { settings?: OAuthSettings, values?: Partial<typeof PASTED>, token?: Partial<PluginDataSource> } = {}): Promise<Plugin> {
    const plugins = database.getRepository(Plugin)
    const saved = await plugins.save(plugins.create({ name: 'AdMob', oauthSettings: settings }))
    await database.getRepository(PluginDataSource).save({ name: 'source', mode: 'fetch', method: 'GET', url: POLL_URL, headers: { Authorization: 'Bearer {{ oauth_access_token }}' }, plugin: saved, ...token })
    for (const [order, field] of OAUTH_FIELDS.entries()) {
      const stored = await database.getRepository(PluginField).save({ keyname: field.keyname, name: field.name, fieldType: 'password', order, plugin: saved })
      const value = values[field.keyname]
      if (value)
        await database.getRepository(PluginFieldValue).save({ value, field: stored, plugin: saved })
    }
    return plugins.findOneOrFail({ where: { id: saved.id }, relations: { dataSources: true, fields: true, templates: true } })
  }

  const storedSource = async (plugin: Plugin) => database.getRepository(PluginDataSource).findOneByOrFail({ id: plugin.dataSources[0].id })
  const sourceDataOf = async (plugin: Plugin) => (await templateContext.contextFor(plugin, [])).sourceData

  it('refreshes before the first poll, polls with the refreshed token and keeps it and its expiry on the Data Source, not in the Field Value', async () => {
    const plugin = await oauthPlugin()

    expect(await sourceDataOf(plugin)).toEqual({ source: { rows: 3 } })

    expect(new URLSearchParams(tokenRequests[0])).toEqual(new URLSearchParams({ grant_type: 'refresh_token', refresh_token: 'pasted-refresh', client_id: 'client', client_secret: 'secret' }))
    expect(pollAuthorizations).toEqual(['Bearer refreshed-access'])
    expect(await storedSource(plugin)).toMatchObject({ oauthAccessToken: 'refreshed-access', oauthAccessTokenExpiresAt: new Date(NOW.getTime() + 3599_000), oauthRefreshedAt: NOW })
    expect((await database.getRepository(PluginFieldValue).find({ relations: { field: true } })).find(row => row.field.keyname === 'oauth_access_token')?.value).toBe('pasted-access')
  })

  it('polls with the stored token while its expiry is more than sixty seconds away, without refreshing', async () => {
    const plugin = await oauthPlugin({ token: { oauthAccessToken: 'stored-access', oauthAccessTokenExpiresAt: new Date(NOW.getTime() + 2 * MINUTE), oauthRefreshedAt: new Date(NOW.getTime() - 58 * MINUTE) } })

    await sourceDataOf(plugin)

    expect(tokenRequests).toEqual([])
    expect(pollAuthorizations).toEqual(['Bearer stored-access'])
  })

  it('refreshes when the stored expiry is within sixty seconds', async () => {
    const plugin = await oauthPlugin({ token: { oauthAccessToken: 'stored-access', oauthAccessTokenExpiresAt: new Date(NOW.getTime() + 59_000), oauthRefreshedAt: new Date(NOW.getTime() - 59 * MINUTE) } })

    await sourceDataOf(plugin)

    expect(tokenRequests).toHaveLength(1)
    expect(pollAuthorizations).toEqual(['Bearer refreshed-access'])
  })

  it.each([
    [49, 0],
    [51, 1],
  ])('with its expiry unknown, refreshes a token last refreshed %i minutes ago %i times', async (minutesAgo, refreshes) => {
    const plugin = await oauthPlugin({ token: { oauthAccessToken: 'stored-access', oauthRefreshedAt: new Date(NOW.getTime() - minutesAgo * MINUTE) } })

    await sourceDataOf(plugin)

    expect(tokenRequests).toHaveLength(refreshes)
  })

  it('refreshes once and polls once more when the poll answers 401', async () => {
    const plugin = await oauthPlugin({ token: { oauthAccessToken: 'revoked-access', oauthAccessTokenExpiresAt: new Date(NOW.getTime() + 30 * MINUTE) } })
    pollEndpoint = init => new Headers(init.headers).get('Authorization') === 'Bearer revoked-access' ? new Response('', { status: 401 }) : jsonResponse({ rows: 3 })

    expect(await sourceDataOf(plugin)).toEqual({ source: { rows: 3 } })
    expect(tokenRequests).toHaveLength(1)
    expect(pollAuthorizations).toEqual(['Bearer revoked-access', 'Bearer refreshed-access'])
  })

  it('gives up after the one retry when the refreshed token is refused too', async () => {
    const plugin = await oauthPlugin({ token: { oauthAccessToken: 'revoked-access', oauthAccessTokenExpiresAt: new Date(NOW.getTime() + 30 * MINUTE) } })
    pollEndpoint = () => new Response('', { status: 401 })

    expect(await sourceDataOf(plugin)).toEqual({ source: { error: true, message: 'HTTP error! status: 401' } })
    expect(tokenRequests).toHaveLength(1)
    expect(pollAuthorizations).toHaveLength(2)
  })

  it('polls with the pasted access token when there is nothing to refresh it with', async () => {
    const plugin = await oauthPlugin({ values: { oauth_access_token: 'pasted-access' } })

    await sourceDataOf(plugin)

    expect(tokenRequests).toEqual([])
    expect(pollAuthorizations).toEqual(['Bearer pasted-access'])
  })

  it('sends the Recipe\'s refresh params, and reads the expiry from the field the Recipe names', async () => {
    const plugin = await oauthPlugin({ settings: { ...ADMOB_SETTINGS, oauth_refresh_params: '{"audience":"reports"}', oauth_expiry_field_name: 'lifetime' } })
    tokenEndpoint = () => jsonResponse({ access_token: 'refreshed-access', lifetime: 600 })

    await sourceDataOf(plugin)

    expect(new URLSearchParams(tokenRequests[0]).get('audience')).toBe('reports')
    expect((await storedSource(plugin)).oauthAccessTokenExpiresAt).toEqual(new Date(NOW.getTime() + 600_000))
  })

  it('keeps the refresh token the token endpoint answers in place of the pasted one, and refreshes with it next', async () => {
    const plugin = await oauthPlugin()
    tokenEndpoint = () => jsonResponse({ access_token: 'refreshed-access', refresh_token: 'rotated-refresh', expires_in: 30 })

    await sourceDataOf(plugin)
    await sourceDataOf(plugin)

    expect(new URLSearchParams(tokenRequests[1]).get('refresh_token')).toBe('rotated-refresh')
  })

  it('counts a refused refresh as a failed fetch of a scheduled tick, naming the token endpoint\'s reply', async () => {
    const plugin = await oauthPlugin()
    tokenEndpoint = () => jsonResponse({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }, { status: 400 })

    await refresh.refresh(plugin, { scheduled: true })

    expect(pollAuthorizations).toEqual([])
    expect(await storedSource(plugin)).toMatchObject({
      fetchFailureStreak: 1,
      lastFetchError: 'The token endpoint answered 400: {"error":"invalid_grant","error_description":"Token has been expired or revoked."}',
      oauthAccessToken: null,
    })
  })
})
