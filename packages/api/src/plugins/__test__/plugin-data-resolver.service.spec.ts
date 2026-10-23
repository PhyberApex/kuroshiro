import type { ConfigService } from '@nestjs/config'
import type { OAuthPoll, PluginOAuthService } from '../services/plugin-oauth.service.js'
import type { PluginRendererService } from '../services/plugin-renderer.service.js'
import { Logger } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InstanceTimeZone } from '../../instance/instance-time-zone.js'
import { makePluginDataSource } from '../../test/fixtures.js'
import { asService } from '../../test/mockService.js'
import { PluginDataFetcherService } from '../services/plugin-data-fetcher.service.js'
import { PluginDataResolverService } from '../services/plugin-data-resolver.service.js'
import { PluginTransformService } from '../services/plugin-transform.service.js'

describe('pluginDataResolverService', () => {
  let service: PluginDataResolverService
  let dataFetcher: PluginDataFetcherService
  let transformer: PluginTransformService

  beforeEach(() => {
    dataFetcher = new PluginDataFetcherService(asService<PluginRendererService>({}), asService<ConfigService>({ get: vi.fn() }), new InstanceTimeZone())
    transformer = new PluginTransformService()
    service = new PluginDataResolverService(dataFetcher, transformer)
  })

  it('resolves every data source in parallel, keyed by name', async () => {
    vi.spyOn(dataFetcher, 'fetchOrLiteral')
      .mockResolvedValueOnce({ temp: '72F' })
      .mockResolvedValueOnce({ count: 5 })

    const data = await service.resolveAll([
      makePluginDataSource({ name: 'weather' }),
      makePluginDataSource({ name: 'calendar' }),
    ])

    expect(data).toEqual({ weather: { temp: '72F' }, calendar: { count: 5 } })
  })

  it('applies transform.js to a source that has one, with the fetched object laid over the template context as its input', async () => {
    vi.spyOn(dataFetcher, 'fetchOrLiteral').mockResolvedValue({ raw: true, city: 'from the response' })
    vi.spyOn(transformer, 'transform').mockResolvedValue({ transformed: true })

    const data = await service.resolveAll([
      makePluginDataSource({ name: 'source', transformJs: 'module.exports = data => data' }),
    ], { city: 'Berlin', trmnl: { user: { locale: 'de' } } })

    expect(transformer.transform).toHaveBeenCalledWith('module.exports = data => data', { city: 'from the response', trmnl: { user: { locale: 'de' }, state: {}, previous_merge_variables: {} }, raw: true }, expect.anything())
    expect(data).toEqual({ source: { transformed: true } })
  })

  it.each([
    ['a list', [1, 2]],
    ['text', '<feed/>'],
    ['null', null],
  ])('gives the transform %s it fetched under data, beside the template context', async (_, fetched) => {
    vi.spyOn(dataFetcher, 'fetchOrLiteral').mockResolvedValue(fetched)
    vi.spyOn(transformer, 'transform').mockResolvedValue({})

    await service.resolveAll([makePluginDataSource({ name: 'source', transformJs: 'x' })], { trmnl: {} })

    expect(transformer.transform).toHaveBeenCalledWith('x', { trmnl: { state: {}, previous_merge_variables: {} }, data: fetched }, expect.anything())
  })

  describe('saved state', () => {
    it('gives the transform its Data Source\'s saved state at input.trmnl.state, and an empty object before any was saved', async () => {
      vi.spyOn(dataFetcher, 'fetchOrLiteral').mockResolvedValue({ n: 1 })
      vi.spyOn(transformer, 'transform').mockResolvedValue({})
      const sources = [makePluginDataSource({ id: 'ds-1', name: 'a', transformJs: 'x' }), makePluginDataSource({ id: 'ds-2', name: 'b', transformJs: 'x' })]

      await service.resolveAll(sources, { trmnl: { user: { locale: 'en' } } }, { savedStates: { 'ds-1': { cursor: 'abc' } } })

      expect(transformer.transform).toHaveBeenCalledWith('x', expect.objectContaining({ trmnl: { user: { locale: 'en' }, state: { cursor: 'abc' }, previous_merge_variables: {} } }), expect.anything())
      expect(transformer.transform).toHaveBeenCalledWith('x', expect.objectContaining({ trmnl: { user: { locale: 'en' }, state: {}, previous_merge_variables: {} } }), expect.anything())
    })

    it('renders the request with the saved state too, so a cursor can go into the URL', async () => {
      const fetchOrLiteral = vi.spyOn(dataFetcher, 'fetchOrLiteral').mockResolvedValue({})
      const source = makePluginDataSource({ id: 'ds-1', name: 'a' })

      await service.resolveAll([source], { trmnl: {} }, { savedStates: { 'ds-1': { cursor: 'abc' } } })

      expect(fetchOrLiteral).toHaveBeenCalledWith(source, { trmnl: { state: { cursor: 'abc' } } }, undefined)
    })

    it('gives the transform its Data Source\'s Previous Output at input.trmnl.previous_merge_variables, an empty object before any, and leaves them out of the request', async () => {
      const fetchOrLiteral = vi.spyOn(dataFetcher, 'fetchOrLiteral').mockResolvedValue({})
      vi.spyOn(transformer, 'transform').mockResolvedValue({})
      const sources = [makePluginDataSource({ id: 'ds-1', name: 'a', transformJs: 'x' }), makePluginDataSource({ id: 'ds-2', name: 'b', transformJs: 'y' })]

      await service.resolveAll(sources, { trmnl: {} }, { previousOutputs: { 'ds-1': { plan: 'pro' } } })

      expect(transformer.transform).toHaveBeenCalledWith('x', { trmnl: { state: {}, previous_merge_variables: { plan: 'pro' } } }, expect.anything())
      expect(transformer.transform).toHaveBeenCalledWith('y', { trmnl: { state: {}, previous_merge_variables: {} } }, expect.anything())
      expect(fetchOrLiteral).toHaveBeenCalledWith(sources[0], { trmnl: { state: {} } }, undefined)
    })

    it('gives the transform its Previous Output on a Plugin polled with an OAuth access token too', async () => {
      vi.spyOn(dataFetcher, 'fetchOrLiteral').mockResolvedValue({})
      vi.spyOn(transformer, 'transform').mockResolvedValue({})
      const oauthTokens = asService<PluginOAuthService>({ withAccessToken: async (_oauth: OAuthPoll, poll: (accessToken: string, lastTry: boolean) => Promise<unknown>) => poll('access', true) })
      const oauth = { pluginId: 'p-1', settings: {}, fieldValues: {} } as unknown as OAuthPoll

      await new PluginDataResolverService(dataFetcher, transformer, oauthTokens).resolveAll([makePluginDataSource({ id: 'ds-1', name: 'a', transformJs: 'x' })], { trmnl: {} }, { previousOutputs: { 'ds-1': { plan: 'pro' } }, oauth })

      expect(transformer.transform).toHaveBeenCalledWith('x', expect.objectContaining({ trmnl: expect.objectContaining({ previous_merge_variables: { plan: 'pro' } }) }), expect.anything())
    })

    it('hands the transform the guarded fetch', async () => {
      vi.spyOn(dataFetcher, 'fetchOrLiteral').mockResolvedValue({})
      const transform = vi.spyOn(transformer, 'transform').mockResolvedValue({})

      await service.resolveAll([makePluginDataSource({ name: 'a', transformJs: 'x' })], {})

      const options = transform.mock.calls[0]![2] as { fetch: (url: string) => unknown }
      const fetchForTransform = vi.spyOn(dataFetcher, 'fetchForTransform').mockResolvedValue(new Response('{}'))
      await options.fetch('https://example.com')
      expect(fetchForTransform).toHaveBeenCalledWith('https://example.com', undefined)
    })
  })

  it('applies a transform to a literal Data Source too', async () => {
    vi.spyOn(transformer, 'transform').mockResolvedValue({ computed: 1 })

    const data = await service.resolveAll([makePluginDataSource({ name: 'source', mode: 'literal', literalValue: { base: 2 }, transformJs: 'x' })], { trmnl: {} })

    expect(transformer.transform).toHaveBeenCalledWith('x', { trmnl: { state: {}, previous_merge_variables: {} }, base: 2 }, expect.anything())
    expect(data).toEqual({ source: { computed: 1 } })
  })

  it('gives a failing source an error marker instead of rejecting the whole call (ADR-0005)', async () => {
    vi.spyOn(dataFetcher, 'fetchOrLiteral')
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('boom'))

    const data = await service.resolveAll([
      makePluginDataSource({ name: 'working' }),
      makePluginDataSource({ name: 'failing' }),
    ])

    expect(data).toEqual({
      working: { ok: true },
      failing: { error: true, message: 'boom' },
    })
  })

  it('resolves an empty array of data sources to an empty object', async () => {
    const data = await service.resolveAll([])
    expect(data).toEqual({})
  })

  it('never logs the failure message, which can quote a password Field Value', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
    vi.spyOn(dataFetcher, 'fetchOrLiteral').mockRejectedValue(new Error('Failed to parse URL from not a url/hunter2'))

    await service.resolveAll([makePluginDataSource({ name: 'weather' })])

    expect(warn).toHaveBeenCalledWith('Data source "weather" failed')
    expect(warn.mock.calls.flat().join(' ')).not.toContain('hunter2')
  })
})
