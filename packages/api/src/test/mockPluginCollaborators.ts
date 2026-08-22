import type { FetchableDataSource } from '../plugins/services/plugin-data-fetcher.service'
import { vi } from 'vitest'

/**
 * `fetchOrLiteral` routes to `fetchData` for a fetch-mode source (this mock replicates
 * that routing, matching `PluginDataFetcherService.fetchOrLiteral`'s real implementation)
 * or resolves `literalValue` directly for a literal-mode one — mirrored here so a spec
 * that only configures `fetchData` still works against the `fetchOrLiteral` call sites
 * every render/schedule/preview path now goes through.
 */
export function createMockPluginDataFetcherService() {
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

export type MockPluginDataFetcherService = ReturnType<typeof createMockPluginDataFetcherService>

export function createMockPluginRendererService() {
  return { render: vi.fn() }
}

export type MockPluginRendererService = ReturnType<typeof createMockPluginRendererService>

export function createMockPluginTransformService() {
  return { transform: vi.fn() }
}

export type MockPluginTransformService = ReturnType<typeof createMockPluginTransformService>
