import type { DeviceModelsService } from '../../device-models/device-models.service.js'
import type { MashupSlot } from '../../mashup/entities/mashup-slot.entity.js'
import type { Screen } from '../../screens/screens.entity.js'
import type { PluginRendererService } from '../services/plugin-renderer.service.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDevice, makeMashupConfiguration, makeMashupSlot, makePlugin, makePluginTemplate, makeScreen } from '../../test/fixtures.js'
import { createMockDeviceModelsService, primeMockDeviceModelsServiceWithAssignedModels, V2 } from '../../test/mockDeviceModelsService.js'
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

  const kitchen = makeScreen({ id: 'screen-kitchen', device: makeDevice({ id: 'device-kitchen', friendlyId: 'KITCHEN' }) })
  const hallway = makeScreen({ id: 'screen-hallway', device: makeDevice({ id: 'device-hallway', friendlyId: 'HALLWAY', deviceModel: V2 }) })

  beforeEach(() => {
    mockRenderer = {
      render: vi.fn().mockResolvedValue('<div>rendered</div>'),
    }

    mockMashupSlotRepo = createMockRepository<MashupSlot>()
    mockMashupSlotRepo.find.mockResolvedValue([])

    mockScreenRepo = Object.assign(createMockRepository<Screen>(), {
      manager: { getRepository: vi.fn(() => mockMashupSlotRepo) },
    })

    mockScreenRepo.find.mockResolvedValue([kitchen, hallway])

    service = new PluginRenderCacheService(asService<PluginRendererService>(mockRenderer), asRepository(mockScreenRepo), asService<DeviceModelsService>(primeMockDeviceModelsServiceWithAssignedModels(createMockDeviceModelsService())))
  })

  const deviceOfEachRender = () => mockRenderer.render.mock.calls.map(([, context]) => context.trmnl?.device)

  it('renders the full Template once per Screen of the Plugin, each told its own Device, and caches each output to its Screen', async () => {
    mockRenderer.render.mockImplementation(async (_markup, context) => `<div>${context.trmnl.device.friendly_id}</div>`)

    await service.renderAndCache(plugin, { data: 'hello', trmnl: {} })

    expect(mockRenderer.render).toHaveBeenCalledWith('{{ data }}', expect.objectContaining({ data: 'hello' }))
    expect(deviceOfEachRender()).toEqual([
      expect.objectContaining({ friendly_id: 'KITCHEN', model: 'og_plus', width: 800, height: 480 }),
      expect.objectContaining({ friendly_id: 'HALLWAY', model: 'v2', width: 1872, height: 1404 }),
    ])
    expect(mockScreenRepo.update).toHaveBeenCalledWith('screen-kitchen', expect.objectContaining({ cachedPluginOutput: '<div>KITCHEN</div>', renderSignal: null }))
    expect(mockScreenRepo.update).toHaveBeenCalledWith('screen-hallway', expect.objectContaining({ cachedPluginOutput: '<div>HALLWAY</div>', renderSignal: null }))
  })

  it('renders a Plugin on no Screen once, told no Device, and caches nothing', async () => {
    mockScreenRepo.find.mockResolvedValue([])

    await service.renderAndCache(plugin, { data: 'hello' })

    expect(mockRenderer.render).toHaveBeenCalledExactlyOnceWith('{{ data }}', { data: 'hello' })
    expect(mockScreenRepo.update).not.toHaveBeenCalled()
  })

  it('still invalidates the Mashups that show a Plugin on no Screen of its own', async () => {
    mockScreenRepo.find.mockResolvedValue([])
    mockMashupSlotRepo.find.mockResolvedValue([makeMashupSlot({ mashupConfiguration: makeMashupConfiguration({ screen: makeScreen({ id: 'screen-mashup' }) }) })])
    injectPrivate(service, 'mashupSlotRepository', asRepository(mockMashupSlotRepo))

    await service.renderAndCache(plugin, { data: 'hello' })

    expect(mockScreenRepo.update).toHaveBeenCalledExactlyOnceWith({ id: 'screen-mashup' }, { cachedPluginOutput: null, renderSignal: null })
  })

  it('writes nothing when a newer render of the Plugin has started by the time every Screen is rendered', async () => {
    let superseded = false
    mockRenderer.render.mockImplementation(async () => {
      superseded = true
      return '<div>stale</div>'
    })
    mockMashupSlotRepo.find.mockResolvedValue([makeMashupSlot({ mashupConfiguration: makeMashupConfiguration({ screen: makeScreen({ id: 'screen-mashup' }) }) })])
    injectPrivate(service, 'mashupSlotRepository', asRepository(mockMashupSlotRepo))

    await service.renderAndCache(plugin, { data: 'hello' }, () => superseded)

    expect(mockRenderer.render).toHaveBeenCalledTimes(2)
    expect(mockScreenRepo.update).not.toHaveBeenCalled()
  })

  it('leaves a Webhook Payload that is an array as the whole context, with no trmnl to tell the Device in', async () => {
    await service.renderAndCache(plugin, [1, 2])

    expect(mockRenderer.render.mock.calls.map(([, context]) => context)).toEqual([[1, 2], [1, 2]])
  })

  it('renders the full Template wherever it is stored among the Plugin\'s Templates', async () => {
    const quadrantFirst = makePlugin({ id: 'plugin-1', templates: [makePluginTemplate({ layout: 'quadrant', liquidMarkup: 'quadrant' }), makePluginTemplate({ layout: 'full', liquidMarkup: 'full' })] })

    await service.renderAndCache(quadrantFirst, {})

    expect(mockRenderer.render).toHaveBeenCalledWith('full', expect.anything())
    expect(mockRenderer.render).not.toHaveBeenCalledWith('quadrant', expect.anything())
  })

  it('rejects with the size and Liquid\'s problem when the Template cannot be rendered for a Screen, and caches nothing to any', async () => {
    mockRenderer.render.mockResolvedValueOnce('<div>kitchen</div>').mockRejectedValue(Object.assign(new Error('undefined variable: city, line:3, col:1'), { token: { getPosition: () => [3, 1] } }))

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
      { cachedPluginOutput: null, renderSignal: null },
    )
    expect(mockScreenRepo.update).toHaveBeenCalledWith(
      { id: 'screen-2' },
      { cachedPluginOutput: null, renderSignal: null },
    )
  })

  it('does not fail if mashupSlotRepository not available', async () => {
    injectPrivate(service, 'mashupSlotRepository', null)

    await expect(service.invalidateMashupCaches('plugin-1')).resolves.toBeUndefined()
    expect(mockScreenRepo.update).not.toHaveBeenCalled()
  })
})
