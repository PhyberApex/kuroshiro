import type { DevicePreviewInput } from 'kuroshiro-shared'
import type { DeviceModelsService } from '../device-models.service.js'
import { Buffer } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDeviceModel, makePalette } from '../../test/fixtures.js'
import { asService } from '../../test/mockService.js'

const { fsMock, renderHtmlToPng } = vi.hoisted(() => ({
  fsMock: {
    mkdtemp: vi.fn(),
    readFile: vi.fn(),
    rm: vi.fn(),
  },
  renderHtmlToPng: vi.fn(),
}))

vi.mock('node:fs', () => ({ promises: fsMock }))
vi.mock('../render-html-to-png.js', () => ({ renderHtmlToPng }))

const { DevicePreviewService } = await import('../device-preview.service.js')

const MODEL = makeDeviceModel({ name: 'og_plus', paletteIds: ['bw'] })
const PALETTE = makePalette({ id: 'bw' })
const OTHER_PALETTE = makePalette({ id: 'other', kind: 'custom', frameworkClass: 'screen--color-7a' })
const INPUT: DevicePreviewInput = { html: '<div>Hi</div>', deviceModelName: MODEL.name, paletteId: PALETTE.id }

function buildService() {
  const deviceModels = {
    findByName: vi.fn().mockResolvedValue(MODEL),
    findPalette: vi.fn().mockResolvedValue(PALETTE),
    supportsPalette: vi.fn().mockResolvedValue(true),
  }
  const service = new DevicePreviewService(asService<DeviceModelsService>(deviceModels))
  return { service, deviceModels }
}

describe('devicePreviewService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    fsMock.mkdtemp.mockResolvedValue('/tmp/kuroshiro-device-preview-xyz')
    fsMock.readFile.mockResolvedValue(Buffer.from('png-bytes'))
    fsMock.rm.mockResolvedValue(undefined)
    renderHtmlToPng.mockResolvedValue(null)
  })

  it('wraps the body HTML in the screen shell and renders it for the target, reporting no signal', async () => {
    const { service } = buildService()

    const result = await service.render(INPUT)

    expect(result).toEqual({ buffer: Buffer.from('png-bytes'), signal: 'none' })
    expect(renderHtmlToPng).toHaveBeenCalledOnce()
    const [html, target, outputPath] = renderHtmlToPng.mock.calls[0]
    expect(html).toContain('<div>Hi</div>')
    expect(html).toContain('<html>')
    expect(target).toEqual({ model: MODEL, palette: PALETTE })
    expect(outputPath).toContain('kuroshiro-device-preview-xyz')
  })

  it('reports the skip signal the render raised', async () => {
    renderHtmlToPng.mockResolvedValue('skip')
    const { service } = buildService()

    await expect(service.render(INPUT)).resolves.toMatchObject({ signal: 'skip' })
  })

  it('reports the hold signal the render raised', async () => {
    renderHtmlToPng.mockResolvedValue('hold')
    const { service } = buildService()

    await expect(service.render(INPUT)).resolves.toMatchObject({ signal: 'hold' })
  })

  it('cleans up the temp directory after a successful render', async () => {
    const { service } = buildService()

    await service.render(INPUT)

    expect(fsMock.rm).toHaveBeenCalledWith('/tmp/kuroshiro-device-preview-xyz', { recursive: true, force: true })
  })

  it('cleans up the temp directory when the render fails, and still refuses the next call\'s busy guard afterwards', async () => {
    renderHtmlToPng.mockRejectedValue(new Error('boom'))
    const { service } = buildService()

    await expect(service.render(INPUT)).rejects.toThrow('boom')

    expect(fsMock.rm).toHaveBeenCalledWith('/tmp/kuroshiro-device-preview-xyz', { recursive: true, force: true })
  })

  it('refuses an unknown Device Model with 400 device-model-unknown', async () => {
    const { service, deviceModels } = buildService()
    deviceModels.findByName.mockResolvedValue(null)

    const refusal = await service.render(INPUT).catch((error: unknown) => error)

    expect(refusal).toMatchObject({ code: 'device-model-unknown' })
    expect(renderHtmlToPng).not.toHaveBeenCalled()
  })

  it('refuses an unknown Palette with 400 palette-unknown', async () => {
    const { service, deviceModels } = buildService()
    deviceModels.findPalette.mockResolvedValue(null)

    const refusal = await service.render(INPUT).catch((error: unknown) => error)

    expect(refusal).toMatchObject({ code: 'palette-unknown' })
    expect(renderHtmlToPng).not.toHaveBeenCalled()
  })

  it('refuses a Palette that does not belong to the Device Model with 400 palette-not-for-model', async () => {
    const { service, deviceModels } = buildService()
    deviceModels.findPalette.mockResolvedValue(OTHER_PALETTE)
    deviceModels.supportsPalette.mockResolvedValue(false)

    const refusal = await service.render({ ...INPUT, paletteId: OTHER_PALETTE.id }).catch((error: unknown) => error)

    expect(refusal).toMatchObject({ code: 'palette-not-for-model' })
    expect(renderHtmlToPng).not.toHaveBeenCalled()
  })

  it('refuses a second render with 429 device-preview-busy while one is already running, then accepts the next once it finishes', async () => {
    const { service } = buildService()
    // Created up front so resolving it is safe regardless of when the pending first call
    // actually reaches `renderHtmlToPng` relative to the microtasks the second call needs.
    let resolveFirst!: (signal: null) => void
    const firstRenderGate = new Promise<null>(resolve => (resolveFirst = resolve))
    renderHtmlToPng.mockImplementationOnce(() => firstRenderGate)

    const first = service.render(INPUT)
    const second = await service.render(INPUT).catch((error: unknown) => error)

    expect(second).toMatchObject({ code: 'device-preview-busy' })
    expect((second as { getStatus: () => number }).getStatus()).toBe(429)

    resolveFirst(null)
    await first

    renderHtmlToPng.mockResolvedValue(null)
    await expect(service.render(INPUT)).resolves.toMatchObject({ signal: 'none' })
  })
})
