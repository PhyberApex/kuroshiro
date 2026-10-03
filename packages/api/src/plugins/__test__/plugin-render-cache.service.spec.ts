import type { MashupSlot } from '../../mashup/entities/mashup-slot.entity.js'
import type { Screen } from '../../screens/screens.entity.js'
import type { PluginRendererService } from '../services/plugin-renderer.service.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeMashupConfiguration, makeMashupSlot, makePlugin, makePluginTemplate, makeScreen } from '../../test/fixtures.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { asService, injectPrivate } from '../../test/mockService.js'
import { PluginRenderCacheService } from '../services/plugin-render-cache.service.js'

describe('pluginRenderCacheService', () => {
  let service: PluginRenderCacheService
  let mockRenderer: { render: ReturnType<typeof vi.fn> }
  let mockScreenRepo: ReturnType<typeof createMockRepository<Screen>> & { manager: { getRepository: ReturnType<typeof vi.fn> } }
  let mockMashupSlotRepo: ReturnType<typeof createMockRepository<MashupSlot>>

  const plugin = makePlugin({
    id: 'plugin-1',
    templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '{{ data }}' })],
  })

  beforeEach(() => {
    mockRenderer = {
      render: vi.fn().mockResolvedValue('<div>rendered</div>'),
    }

    mockMashupSlotRepo = createMockRepository<MashupSlot>()
    mockMashupSlotRepo.find.mockResolvedValue([])

    mockScreenRepo = Object.assign(createMockRepository<Screen>(), {
      manager: { getRepository: vi.fn(() => mockMashupSlotRepo) },
    })

    service = new PluginRenderCacheService(asService<PluginRendererService>(mockRenderer), asRepository(mockScreenRepo))
  })

  it('renders the full Template and caches it to every Screen of the Plugin', async () => {
    await service.renderAndCache(plugin, { data: 'hello' })

    expect(mockRenderer.render).toHaveBeenCalledWith('{{ data }}', { data: 'hello' })
    expect(mockScreenRepo.update).toHaveBeenCalledWith(
      { plugin: { id: 'plugin-1' } },
      expect.objectContaining({ cachedPluginOutput: '<div>rendered</div>' }),
    )
  })

  it('renders the full Template wherever it is stored among the Plugin\'s Templates', async () => {
    const quadrantFirst = makePlugin({ id: 'plugin-1', templates: [makePluginTemplate({ layout: 'quadrant', liquidMarkup: 'quadrant' }), makePluginTemplate({ layout: 'full', liquidMarkup: 'full' })] })

    await service.renderAndCache(quadrantFirst, {})

    expect(mockRenderer.render).toHaveBeenCalledExactlyOnceWith('full', {})
  })

  it('rejects with the size and Liquid\'s problem when the Template cannot be rendered, and caches nothing', async () => {
    mockRenderer.render.mockRejectedValue(Object.assign(new Error('undefined variable: city, line:3, col:1'), { token: { getPosition: () => [3, 1] } }))

    await expect(service.renderAndCache(plugin, {})).rejects.toMatchObject({ size: 'full', problem: { message: 'undefined variable: city', line: 3 } })
    expect(mockScreenRepo.update).not.toHaveBeenCalled()
  })

  it('does nothing when the plugin has no template', async () => {
    await service.renderAndCache(makePlugin({ ...plugin, templates: [] }), {})

    expect(mockRenderer.render).not.toHaveBeenCalled()
    expect(mockScreenRepo.update).not.toHaveBeenCalled()
  })

  it('invalidates mashup caches when plugin updates', async () => {
    mockMashupSlotRepo.find.mockResolvedValue([
      makeMashupSlot({ id: 'slot-1', mashupConfiguration: makeMashupConfiguration({ screen: makeScreen({ id: 'screen-1' }) }) }),
      makeMashupSlot({ id: 'slot-2', mashupConfiguration: makeMashupConfiguration({ screen: makeScreen({ id: 'screen-2' }) }) }),
    ])
    injectPrivate(service, 'mashupSlotRepository', asRepository(mockMashupSlotRepo))

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
    injectPrivate(service, 'mashupSlotRepository', null)

    await expect(service.invalidateMashupCaches('plugin-1')).resolves.toBeUndefined()
    expect(mockScreenRepo.update).not.toHaveBeenCalled()
  })
})
