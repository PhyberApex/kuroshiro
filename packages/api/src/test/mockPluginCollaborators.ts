import type { Mock } from 'vitest'
import type { FetchableDataSource } from '../plugins/services/plugin-data-fetcher.service.js'
import { vi } from 'vitest'

export interface MockPluginDataFetcherService {
  fetchData: Mock
  fetchOrLiteral: Mock<(source: FetchableDataSource, templateContext?: object) => Promise<unknown>>
}

export interface MockPluginRendererService {
  render: Mock
}

export interface MockPluginTransformService {
  transform: Mock
}

/**
 * `fetchOrLiteral` routes to `fetchData` for a fetch-mode source (this mock replicates
 * that routing, matching `PluginDataFetcherService.fetchOrLiteral`'s real implementation)
 * or resolves `literalValue` directly for a literal-mode one — mirrored here so a spec
 * that only configures `fetchData` still works against the `fetchOrLiteral` call sites
 * every render/schedule/preview path now goes through.
 */
export function createMockPluginDataFetcherService(): MockPluginDataFetcherService {
  const mock = {
    fetchData: vi.fn(),
    fetchOrLiteral: vi.fn((source: FetchableDataSource, templateContext?: object) =>
      source.mode === 'literal'
        ? Promise.resolve(source.literalValue ?? null)
        // Looked up off `mock` (not captured as a local) so a spec that reassigns
        // `mockDataFetcher.fetchData = vi.fn()...` after construction is still honored.
        : mock.fetchData(source.method || 'GET', source.url || '', source.headers, source.body, templateContext)),
  }
  return mock
}

export function createMockPluginRendererService(): MockPluginRendererService {
  return { render: vi.fn() }
}

export function createMockPluginTransformService(): MockPluginTransformService {
  return { transform: vi.fn() }
}
