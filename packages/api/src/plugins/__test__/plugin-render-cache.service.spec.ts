import type { Plugin } from '../entities/plugin.entity'
import type { PluginRendererService } from '../services/plugin-renderer.service'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PluginRenderCacheService } from '../services/plugin-render-cache.service'

describe('pluginRenderCacheService', () => {
  let service: PluginRenderCacheService
  let mockRenderer: PluginRendererService
  let mockScreenRepo: any
  let mockMashupSlotRepo: any

  const plugin = {
    id: 'plugin-1',
    templates: [{ layout: 'full', liquidMarkup: '{{ data }}' }],
  } as unknown as Plugin

  beforeEach(() => {
    mockRenderer = {
      render: vi.fn().mockResolvedValue('<div>rendered</div>'),
    } as any

    mockMashupSlotRepo = {
      find: vi.fn().mockResolvedValue([]),
    }

    mockScreenRepo = {
      update: vi.fn(),
      manager: { getRepository: vi.fn(() => mockMashupSlotRepo) },
    }

    service = new PluginRenderCacheService(mockRenderer, mockScreenRepo)
  })

  it('renders the primary template and caches it to every screen of the plugin', async () => {
    await service.renderAndCache(plugin, { data: 'hello' })

    expect(mockRenderer.render).toHaveBeenCalledWith('{{ data }}', { data: 'hello' })
    expect(mockScreenRepo.update).toHaveBeenCalledWith(
      { plugin: { id: 'plugin-1' } },
      expect.objectContaining({ cachedPluginOutput: '<div>rendered</div>' }),
    )
  })

  it('does nothing when the plugin has no template', async () => {
    await service.renderAndCache({ ...plugin, templates: [] } as unknown as Plugin, {})

    expect(mockRenderer.render).not.toHaveBeenCalled()
    expect(mockScreenRepo.update).not.toHaveBeenCalled()
  })

  it('invalidates mashup caches when plugin updates', async () => {
    mockMashupSlotRepo.find = vi.fn().mockResolvedValue([
      { id: 'slot-1', mashupConfiguration: { screen: { id: 'screen-1' } } },
      { id: 'slot-2', mashupConfiguration: { screen: { id: 'screen-2' } } },
    ])
    ;(service as any).mashupSlotRepository = mockMashupSlotRepo

    await service.invalidateMashupCaches('plugin-1')

    expect(mockMashupSlotRepo.find).toHaveBeenCalledWith({
      where: { plugin: { id: 'plugin-1' } },
      relations: { mashupConfiguration: { screen: true } },
    })
    expect(mockScreenRepo.update).toHaveBeenCalledWith(
      { id: 'screen-1' },
      { cachedPluginOutput: null },
    )
    expect(mockScreenRepo.update).toHaveBeenCalledWith(
      { id: 'screen-2' },
      { cachedPluginOutput: null },
    )
  })

  it('does not fail if mashupSlotRepository not available', async () => {
    ;(service as any).mashupSlotRepository = null

    await expect(service.invalidateMashupCaches('plugin-1')).resolves.toBeUndefined()
    expect(mockScreenRepo.update).not.toHaveBeenCalled()
  })
})
