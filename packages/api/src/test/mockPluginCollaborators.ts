import type { Mock } from 'vitest'
import type { FetchableDataSource } from '../plugins/services/plugin-data-fetcher.service.js'
import type { PluginFieldValuesService } from '../plugins/services/plugin-field-values.service.js'
import { vi } from 'vitest'
import { PluginTemplateContextService } from '../plugins/services/plugin-template-context.service.js'

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

export interface MockPluginRenderCacheService {
  invalidateMashupCaches: Mock
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

export function createMockPluginRenderCacheService(): MockPluginRenderCacheService {
  return { invalidateMashupCaches: vi.fn() }
}

/** The real template context builder over a fixed set of resolved Field Values, for specs that don't have a database behind them. */
export function createPluginTemplateContextService(resolvedFieldValues: Record<string, string> = {}): PluginTemplateContextService {
  return new PluginTemplateContextService({ resolveFor: async () => resolvedFieldValues } as unknown as PluginFieldValuesService)
}

/** A Plugin with no stored Field Values: reads attach an empty view, writes change nothing. */
export interface MockPluginFieldValuesService {
  storedByPlugin: Mock<(pluginIds: string[]) => Promise<Map<string, Record<string, string>>>>
  storedFor: Mock<() => Promise<Record<string, string>>>
  resolveFor: Mock<() => Promise<Record<string, string>>>
  attach: Mock<(plugins: object[]) => Promise<object[]>>
  assertWritable: Mock
  write: Mock<() => Promise<boolean>>
}

export function createMockPluginFieldValuesService(): MockPluginFieldValuesService {
  return {
    storedByPlugin: vi.fn(async (pluginIds: string[]) => new Map(pluginIds.map(id => [id, {} as Record<string, string>]))),
    storedFor: vi.fn(async () => ({} as Record<string, string>)),
    resolveFor: vi.fn(async () => ({} as Record<string, string>)),
    attach: vi.fn(async (plugins: object[]) => plugins.map(plugin => ({ ...plugin, fieldValues: {}, needsValues: false }))),
    assertWritable: vi.fn(),
    write: vi.fn(async () => false),
  }
}
