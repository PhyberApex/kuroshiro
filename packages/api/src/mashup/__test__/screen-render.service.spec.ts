import type { ConfigService } from '@nestjs/config'
import type { DeviceModelsService } from '../../device-models/device-models.service.js'
import type { Device } from '../../devices/devices.entity.js'
import type { Screen } from '../../screens/screens.entity.js'
import type { MockDeviceModelsService } from '../../test/mockDeviceModelsService.js'
import type { MashupRendererService } from '../services/mashup-renderer.service.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RENDER_FAILED } from '../../screens/render-outcome.js'
import { makeDevice, makeMashupConfiguration, makeScreen } from '../../test/fixtures.js'
import { createMockDeviceModelsService, primeMockDeviceModelsService } from '../../test/mockDeviceModelsService.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { asService } from '../../test/mockService.js'
import { ScreenRenderService } from '../services/screen-render.service.js'

const { renderHtmlToPng } = vi.hoisted(() => ({ renderHtmlToPng: vi.fn() }))

vi.mock('../../device-models/render-html-to-png.js', () => ({ renderHtmlToPng }))

describe('screenRenderService', () => {
  let service: ScreenRenderService
  let screenRepo: ReturnType<typeof createMockRepository<Screen>>
  let configService: { get: ReturnType<typeof vi.fn> }
  let deviceModels: MockDeviceModelsService
  let mashupRenderer: { renderMashup: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    screenRepo = createMockRepository<Screen>()
    configService = { get: vi.fn().mockReturnValue('http://api') }
    deviceModels = createMockDeviceModelsService()
    primeMockDeviceModelsService(deviceModels)
    mashupRenderer = { renderMashup: vi.fn() }
    renderHtmlToPng.mockReset().mockResolvedValue(null)

    service = new ScreenRenderService(
      asRepository(screenRepo),
      asService<ConfigService>(configService),
      asService<DeviceModelsService>(deviceModels),
      asService<MashupRendererService>(mashupRenderer),
    )
  })

  describe('renderAfterSave', () => {
    const device: Device = makeDevice({ id: 'device-1' })
    const screenWithDevice = makeScreen({ id: 'screen-1', type: 'mashup', device })
    const screenWithMashup = makeScreen({
      id: 'screen-1',
      type: 'mashup',
      device,
      mashupConfiguration: makeMashupConfiguration({ id: 'config-1', slots: [] }),
    })

    function primeLookups() {
      screenRepo.findOne.mockImplementation(async options => (
        options.relations && 'device' in options.relations ? screenWithDevice : screenWithMashup
      ))
    }

    it('does nothing when the Screen no longer exists', async () => {
      screenRepo.findOne.mockResolvedValue(null)

      await expect(service.renderAfterSave('screen-1')).resolves.toBeUndefined()

      expect(mashupRenderer.renderMashup).not.toHaveBeenCalled()
    })

    it('renders the Mashup on demand, caches it, and writes the new PNG', async () => {
      primeLookups()
      mashupRenderer.renderMashup.mockResolvedValue('<div class="mashup">new</div>')

      await service.renderAfterSave('screen-1')

      expect(mashupRenderer.renderMashup).toHaveBeenCalledWith(screenWithMashup.mashupConfiguration, device)
      expect(screenRepo.update).toHaveBeenCalledWith(
        { id: 'screen-1' },
        expect.objectContaining({ cachedPluginOutput: '<div class="mashup">new</div>', renderSignal: null }),
      )
      expect(renderHtmlToPng).toHaveBeenCalled()
    })

    it('logs and resolves quietly when the render fails', async () => {
      primeLookups()
      mashupRenderer.renderMashup.mockRejectedValue(new Error('boom'))

      await expect(service.renderAfterSave('screen-1')).resolves.toBeUndefined()
    })

    it('logs and resolves quietly when the initial lookup throws', async () => {
      screenRepo.findOne.mockRejectedValue(new Error('db unreachable'))

      await expect(service.renderAfterSave('screen-1')).resolves.toBeUndefined()
    })
  })

  describe('renderMashupScreen', () => {
    const device: Device = makeDevice({ id: 'device-1' })

    it('uses the cached output instead of rendering the Mashup again', async () => {
      const screen = makeScreen({
        id: 'screen-1',
        type: 'mashup',
        device,
        cachedPluginOutput: '<div class="mashup">cached</div>',
        mashupConfiguration: makeMashupConfiguration({ id: 'config-1' }),
      })
      screenRepo.findOne.mockResolvedValue(screen)

      const outcome = await service.renderMashupScreen(screen, device, false)

      expect(mashupRenderer.renderMashup).not.toHaveBeenCalled()
      expect(outcome).toBe('http://api/screens/devices/device-1/screen-1.png')
    })

    it('answers RENDER_FAILED and logs when the lookup throws', async () => {
      const screen = makeScreen({ id: 'screen-1', type: 'mashup', device })
      screenRepo.findOne.mockRejectedValue(new Error('boom'))

      expect(await service.renderMashupScreen(screen, device, false)).toBe(RENDER_FAILED)
    })
  })
})
