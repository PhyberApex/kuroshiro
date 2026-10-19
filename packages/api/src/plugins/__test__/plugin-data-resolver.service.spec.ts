import type { ConfigService } from '@nestjs/config'
import type { PluginRendererService } from '../services/plugin-renderer.service.js'
import { Logger } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
    dataFetcher = new PluginDataFetcherService(asService<PluginRendererService>({}), asService<ConfigService>({ get: vi.fn() }))
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

    expect(transformer.transform).toHaveBeenCalledWith('module.exports = data => data', { city: 'from the response', trmnl: { user: { locale: 'de' } }, raw: true })
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

    expect(transformer.transform).toHaveBeenCalledWith('x', { trmnl: {}, data: fetched })
  })

  it('applies a transform to a literal Data Source too', async () => {
    vi.spyOn(transformer, 'transform').mockResolvedValue({ computed: 1 })

    const data = await service.resolveAll([makePluginDataSource({ name: 'source', mode: 'literal', literalValue: { base: 2 }, transformJs: 'x' })], { trmnl: {} })

    expect(transformer.transform).toHaveBeenCalledWith('x', { trmnl: {}, base: 2 })
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
