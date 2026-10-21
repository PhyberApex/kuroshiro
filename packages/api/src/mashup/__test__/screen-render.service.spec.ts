import type { ConfigService } from '@nestjs/config'
import type { DeviceModelsService } from '../../device-models/device-models.service.js'
import type { Device } from '../../devices/devices.entity.js'
import type { Screen } from '../../screens/screens.entity.js'
import type { MockDeviceModelsService } from '../../test/mockDeviceModelsService.js'
import type { MashupConfiguration } from '../entities/mashup-configuration.entity.js'
import type { MashupSlot } from '../entities/mashup-slot.entity.js'
import type { MashupRendererService } from '../services/mashup-renderer.service.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RENDER_FAILED, RENDER_HELD, RENDER_SKIPPED } from '../../screens/render-outcome.js'
import { makeDevice, makeMashupConfiguration, makeMashupSlot, makePlugin, makeScreen } from '../../test/fixtures.js'
import { createMockDeviceModelsService, primeMockDeviceModelsService } from '../../test/mockDeviceModelsService.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { asService } from '../../test/mockService.js'
import { ScreenRenderService } from '../services/screen-render.service.js'

const { renderHtmlToPng, readHtmlRenderSignal } = vi.hoisted(() => ({ renderHtmlToPng: vi.fn(), readHtmlRenderSignal: vi.fn() }))

vi.mock('../../device-models/render-html-to-png.js', () => ({ renderHtmlToPng, readHtmlRenderSignal }))

describe('screenRenderService', () => {
  let service: ScreenRenderService
  let screenRepo: ReturnType<typeof createMockRepository<Screen>>
  let configService: { get: ReturnType<typeof vi.fn> }
  let deviceModels: MockDeviceModelsService
  let mashupRenderer: { renderMashup: ReturnType<typeof vi.fn> }
  let slotRepo: ReturnType<typeof createMockRepository<MashupSlot>>
  let mashupRepo: ReturnType<typeof createMockRepository<MashupConfiguration>>

  beforeEach(() => {
    screenRepo = createMockRepository<Screen>()
    configService = { get: vi.fn().mockReturnValue('http://api') }
    deviceModels = createMockDeviceModelsService()
    primeMockDeviceModelsService(deviceModels)
    mashupRenderer = { renderMashup: vi.fn() }
    slotRepo = createMockRepository<MashupSlot>()
    mashupRepo = createMockRepository<MashupConfiguration>()
    renderHtmlToPng.mockReset().mockResolvedValue(null)
    readHtmlRenderSignal.mockReset().mockResolvedValue(null)

    service = new ScreenRenderService(
      asRepository(screenRepo),
      asService<ConfigService>(configService),
      asService<DeviceModelsService>(deviceModels),
      asService<MashupRendererService>(mashupRenderer),
      asRepository(slotRepo),
      asRepository(mashupRepo),
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
      mashupRenderer.renderMashup.mockResolvedValue({ html: '<div class="mashup">new</div>', slots: [] })

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

  describe('a Render Signal raised inside a Mashup (ADR-0067)', () => {
    const device: Device = makeDevice({ id: 'device-1' })
    const IMAGE = 'http://api/screens/devices/device-1/screen-1.png'

    /** A slot whose markup names the signal it raises on its own page, read back by the mocked `readHtmlRenderSignal`. */
    function slot(id: string, order: number, raises: 'skip' | 'hold' | null, overrides: Partial<MashupSlot> = {}): MashupSlot {
      return makeMashupSlot({ id, order, size: 'view--quadrant', plugin: makePlugin({ id: `${id}-plugin`, name: `Plugin ${id}` }), renderedMarkup: `<p>${id}${raises ? ` raises ${raises}` : ''}</p>`, liveMarkup: null, renderSignal: null, ...overrides })
    }

    function mashupScreen(slots: MashupSlot[]): Screen {
      const screen = makeScreen({ id: 'screen-1', type: 'mashup', device, cachedPluginOutput: '<div class="mashup">whole page</div>', mashupConfiguration: makeMashupConfiguration({ id: 'config-1', layout: '2x2', slots }) })
      screenRepo.findOne.mockResolvedValue(screen)
      return screen
    }

    /** The whole page raises `wholePage`; a page holding one slot alone raises what that slot's markup names. */
    function primeSignals(wholePage: 'skip' | 'hold' | null) {
      renderHtmlToPng.mockImplementation(async (html: string) =>
        html.includes('whole page') ? wholePage : null)
      readHtmlRenderSignal.mockImplementation(async (html: string) => html.includes('raises skip') ? 'skip' : html.includes('raises hold') ? 'hold' : null)
    }

    /** The body markup of the last image actually drawn. */
    function lastDrawnHtml(): string {
      return String(renderHtmlToPng.mock.calls.at(-1)?.[0])
    }

    it('draws the whole page and reads no slot on its own when the page raises no signal', async () => {
      const screen = mashupScreen([slot('a', 0, null), slot('b', 1, null)])
      primeSignals(null)

      expect(await service.renderMashupScreen(screen, device, true)).toBe(IMAGE)

      expect(readHtmlRenderSignal).not.toHaveBeenCalled()
      expect(renderHtmlToPng).toHaveBeenCalledTimes(1)
    })

    it('draws a skipping slot empty and the live ones as they are', async () => {
      const screen = mashupScreen([slot('a', 0, 'skip'), slot('b', 1, null)])
      primeSignals('skip')

      expect(await service.renderMashupScreen(screen, device, true)).toBe(IMAGE)

      const drawn = lastDrawnHtml()
      expect(drawn).toContain('<div class="view view--quadrant"></div>')
      expect(drawn).toContain('<p>b</p>')
      expect(drawn).not.toContain('raises skip')
    })

    it('draws a holding slot with the markup it last drew live', async () => {
      const screen = mashupScreen([slot('a', 0, 'hold', { liveMarkup: '<p>a yesterday</p>' }), slot('b', 1, null)])
      primeSignals('hold')

      expect(await service.renderMashupScreen(screen, device, true)).toBe(IMAGE)

      expect(lastDrawnHtml()).toContain('<p>a yesterday</p>')
      expect(lastDrawnHtml()).not.toContain('raises hold')
    })

    it('draws a holding slot empty when it has never drawn live', async () => {
      const screen = mashupScreen([slot('a', 0, 'hold'), slot('b', 1, null)])
      primeSignals('hold')

      await service.renderMashupScreen(screen, device, true)

      expect(lastDrawnHtml()).toContain('<div class="view view--quadrant"></div>')
    })

    it('a slot holds the markup it drew live on an earlier render', async () => {
      const a = slot('a', 0, null)
      const screen = mashupScreen([a, slot('b', 1, null)])
      primeSignals(null)
      await service.renderMashupScreen(screen, device, true)

      // The Plugin's next refresh raises `hold`.
      a.renderedMarkup = '<p>a raises hold</p>'
      primeSignals('hold')
      await service.renderMashupScreen(screen, device, true)

      expect(lastDrawnHtml()).toContain('<p>a</p>')
    })

    it('records a live slot\'s markup even when another slot signals', async () => {
      const b = slot('b', 1, null)
      const screen = mashupScreen([slot('a', 0, 'skip'), b])
      primeSignals('skip')

      await service.renderMashupScreen(screen, device, false)

      expect(b.liveMarkup).toBe('<p>b</p>')
      expect(slotRepo.update).toHaveBeenCalledWith({ id: 'b' }, { liveMarkup: '<p>b</p>' })
    })

    it('still draws the Plugin name of a failed slot next to a skipping one', async () => {
      const screen = mashupScreen([slot('a', 0, 'skip'), slot('b', 1, null, { renderedMarkup: null })])
      primeSignals('skip')

      expect(await service.renderMashupScreen(screen, device, true)).toBe(IMAGE)

      expect(lastDrawnHtml()).toContain('Plugin b')
    })

    it('renders a failed slot\'s Plugin name even when every other slot holds', async () => {
      const screen = mashupScreen([slot('a', 0, 'hold', { liveMarkup: '<p>a yesterday</p>' }), slot('b', 1, null, { renderedMarkup: null })])
      primeSignals('hold')

      expect(await service.renderMashupScreen(screen, device, true)).toBe(IMAGE)

      expect(lastDrawnHtml()).toContain('Plugin b')
      expect(lastDrawnHtml()).toContain('<p>a yesterday</p>')
    })

    it('skips as a whole when every slot skips', async () => {
      const screen = mashupScreen([slot('a', 0, 'skip'), slot('b', 1, 'skip')])
      primeSignals('skip')

      expect(await service.renderMashupScreen(screen, device, true)).toBe(RENDER_SKIPPED)
      expect(renderHtmlToPng).toHaveBeenCalledTimes(1)
    })

    it.each([
      ['every slot holds', ['hold', 'hold']],
      ['slots hold and skip with none live', ['hold', 'skip']],
    ] as const)('holds as a whole when %s', async (_name, raised) => {
      const screen = mashupScreen([slot('a', 0, raised[0]), slot('b', 1, raised[1])])
      primeSignals('hold')

      expect(await service.renderMashupScreen(screen, device, true)).toBe(RENDER_HELD)
      expect(renderHtmlToPng).toHaveBeenCalledTimes(1)
    })

    it.each([
      ['every slot skips', ['skip', 'skip']],
      ['every slot holds', ['hold', 'hold']],
    ] as const)('draws slot by slot, not the whole page, when %s but the signal is not honoured', async (_name, raised) => {
      const screen = mashupScreen([slot('a', 0, raised[0], { liveMarkup: '<p>a yesterday</p>' }), slot('b', 1, raised[1])])
      primeSignals(raised[0])

      expect(await service.renderMashupScreen(screen, device, false)).toBe(IMAGE)

      const drawn = lastDrawnHtml()
      expect(drawn).not.toContain('whole page')
      expect(drawn).not.toContain(`raises ${raised[0]}`)
      expect(drawn).toContain(raised[0] === 'hold' ? '<p>a yesterday</p>' : '<div class="view view--quadrant"></div>')
    })

    it('reads each slot once per cached output when the whole page signals but no slot does alone', async () => {
      const screen = mashupScreen([slot('a', 0, null), slot('b', 1, null)])
      primeSignals('skip')

      expect(await service.renderMashupScreen(screen, device, true)).toBe(IMAGE)
      expect(await service.renderMashupScreen(screen, device, true)).toBe(IMAGE)

      expect(readHtmlRenderSignal).toHaveBeenCalledTimes(2)
      expect(renderHtmlToPng.mock.calls.at(-1)?.[5]).toEqual({ honorRenderSignal: false })
    })

    it('reads the slots again once the cached output is written again', async () => {
      const a = slot('a', 0, 'skip')
      const screen = mashupScreen([a, slot('b', 1, null)])
      primeSignals('skip')
      await service.renderMashupScreen(screen, device, true)

      screen.cachedPluginOutput = null
      mashupRenderer.renderMashup.mockImplementation(async (mashup: MashupConfiguration) => ({
        html: '<div class="mashup">whole page</div>',
        slots: mashup.slots.map(s => ({ slot: s, markup: `<p>${s.id}</p>` })),
      }))
      primeSignals(null)

      expect(await service.renderMashupScreen(screen, device, true)).toBe(IMAGE)
      expect(a.renderSignal).toBeNull()
      expect(a.renderedMarkup).toBe('<p>a</p>')
      expect(screen.mashupConfiguration!.slotSignalsRead).toBe(false)
    })
  })
})
