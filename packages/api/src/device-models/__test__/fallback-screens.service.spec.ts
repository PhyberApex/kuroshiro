import type { ConfigService } from '@nestjs/config'
import type { FallbackScreenDevice } from '../fallback-screens.service.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BW, GRAY_16, OG_PLUS, V2 } from '../../test/mockDeviceModelsService.js'
import { asService } from '../../test/mockService.js'
import { FALLBACK_SCREEN_TEMPLATE_VERSION } from '../fallback-screen-templates.js'
import { FallbackScreensService } from '../fallback-screens.service.js'

const { statMock, renderHtmlToPng } = vi.hoisted(() => ({
  statMock: vi.fn(),
  renderHtmlToPng: vi.fn(),
}))

vi.mock('node:fs', () => ({
  promises: { stat: statMock },
}))

vi.mock('../render-html-to-png.js', () => ({ renderHtmlToPng }))

vi.mock('../../utils/pathHelper.js', () => ({
  resolveAppPath: (...segments: string[]) => `/app/${segments.join('/')}`,
}))

const KITCHEN: FallbackScreenDevice = { name: 'Kitchen', friendlyId: '4F2A1C', sleepEndTime: 7 * 3600 }

describe('fallbackScreensService', () => {
  let service: FallbackScreensService
  const target = { model: V2, palette: GRAY_16 }
  const cacheUrl = `http://api/screens/fallback/v${FALLBACK_SCREEN_TEMPLATE_VERSION}/v2-gray-16`
  const renderedFiles = new Set<string>()

  /** A disk that keeps what was rendered, so a second ask for the same sheet finds its file. */
  function rememberRenders() {
    renderedFiles.clear()
    statMock.mockImplementation(async (path: string) => {
      if (!renderedFiles.has(path))
        throw new Error('ENOENT')
      return {}
    })
    renderHtmlToPng.mockImplementation(async (_html: string, _target: unknown, outputPath: string) => {
      renderedFiles.add(outputPath)
    })
  }

  const renderedHtml = (call = 0): string => renderHtmlToPng.mock.calls[call][0]

  beforeEach(() => {
    vi.resetAllMocks()
    rememberRenders()
    service = new FallbackScreensService(asService<ConfigService>({ get: () => 'http://api' }))
  })

  it('renders the sheet for the target without dithering and serves it from the cache folder', async () => {
    const url = await service.urlFor({ kind: 'noScreen' }, KITCHEN, target)

    expect(url).toMatch(new RegExp(`^${cacheUrl}/noScreen-[0-9a-f]{16}\\.png$`))
    const outputPath = url.replace('http://api', '/app/public')
    expect(renderHtmlToPng).toHaveBeenCalledExactlyOnceWith(expect.any(String), target, outputPath, expect.any(Object), { dither: false })
  })

  it('prints the Device\'s name and the Instance\'s address', async () => {
    await service.urlFor({ kind: 'noScreen' }, KITCHEN, target)

    expect(renderedHtml()).toContain('<div>Kitchen</div><div class="mono">http://api</div>')
  })

  it('renders once for the same Device asked twice', async () => {
    const first = await service.urlFor({ kind: 'noScreen' }, KITCHEN, target)
    const second = await service.urlFor({ kind: 'noScreen' }, KITCHEN, target)

    expect(second).toBe(first)
    expect(renderHtmlToPng).toHaveBeenCalledTimes(1)
  })

  it('gives two Devices of the same Device Model and Palette with different names different files', async () => {
    const kitchen = await service.urlFor({ kind: 'noScreen' }, KITCHEN, target)
    const hall = await service.urlFor({ kind: 'noScreen' }, { ...KITCHEN, name: 'Hall' }, target)

    expect(hall).not.toBe(kitchen)
    expect(renderHtmlToPng).toHaveBeenCalledTimes(2)
  })

  it('renders a new file when the Device is renamed', async () => {
    const before = await service.urlFor({ kind: 'error', cause: 'mirror' }, KITCHEN, target)
    const after = await service.urlFor({ kind: 'error', cause: 'mirror' }, { ...KITCHEN, name: 'Pantry' }, target)

    expect(after).not.toBe(before)
    expect(renderedHtml(1)).toContain('<div>Pantry</div>')
  })

  it('prints the wake time on sleep and renders a new file when it changes', async () => {
    const before = await service.urlFor({ kind: 'sleep' }, KITCHEN, target)
    const after = await service.urlFor({ kind: 'sleep' }, { ...KITCHEN, sleepEndTime: 6 * 3600 + 5 * 60 + 59 }, target)

    expect(renderedHtml(0)).toContain('Asleep until 07:00')
    expect(renderedHtml(1)).toContain('Asleep until 06:05')
    expect(after).not.toBe(before)
  })

  it('shares a file between Devices whose sheets print the same', async () => {
    const kitchen = await service.urlFor({ kind: 'noScreen' }, KITCHEN, target)
    const kitchenWakingLater = await service.urlFor({ kind: 'noScreen' }, { ...KITCHEN, friendlyId: 'AAAAAA', sleepEndTime: 8 * 3600 }, target)

    expect(kitchenWakingLater).toBe(kitchen)
    expect(renderHtmlToPng).toHaveBeenCalledTimes(1)
  })

  it('keeps the two error wordings and each Screen\'s name apart', async () => {
    const urls = await Promise.all([
      service.urlFor({ kind: 'error', cause: 'mirror' }, KITCHEN, target),
      service.urlFor({ kind: 'error', cause: 'render', screenName: 'Weather' }, KITCHEN, target),
      service.urlFor({ kind: 'error', cause: 'render', screenName: 'Calendar' }, KITCHEN, target),
    ])

    expect(new Set(urls).size).toBe(3)
    expect(renderedHtml(0)).toContain('Mirroring failed')
    expect(renderedHtml(1)).toContain('<span class="name">Weather</span><span>could not be shown</span>')
  })

  it('keeps Device Models and Palettes apart', async () => {
    const onV2 = await service.urlFor({ kind: 'noScreen' }, KITCHEN, target)
    const onOg = await service.urlFor({ kind: 'noScreen' }, KITCHEN, { model: OG_PLUS, palette: BW })

    expect(onOg).toMatch(new RegExp(`^http://api/screens/fallback/v${FALLBACK_SCREEN_TEMPLATE_VERSION}/og_plus-bw/noScreen-`))
    expect(onOg).not.toBe(onV2)
  })

  it.each(['welcome', 'noScreen', 'sleep'] as const)('falls back to the static %s image when rendering fails', async (kind) => {
    renderHtmlToPng.mockRejectedValue(new Error('puppeteer exploded'))

    await expect(service.urlFor({ kind }, KITCHEN, target)).resolves.toBe(`http://api/screens/${kind}.png`)
  })

  it('falls back to the static error image when rendering fails, whatever the cause', async () => {
    renderHtmlToPng.mockRejectedValue(new Error('puppeteer exploded'))

    await expect(service.urlFor({ kind: 'error', cause: 'mirror' }, KITCHEN, target)).resolves.toBe('http://api/screens/error.png')
    await expect(service.urlFor({ kind: 'error', cause: 'render', screenName: 'Weather' }, KITCHEN, target)).resolves.toBe('http://api/screens/error.png')
  })
})
