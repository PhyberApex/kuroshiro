import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FallbackScreensService } from '../fallback-screens.service'
import { GRAY_16, V2 } from './mockDeviceModelsService'

const { statMock, mkdirMock, convertToPng } = vi.hoisted(() => ({
  statMock: vi.fn(),
  mkdirMock: vi.fn(),
  convertToPng: vi.fn(),
}))

vi.mock('node:fs', () => ({
  promises: { stat: statMock, mkdir: mkdirMock },
}))

vi.mock('../../utils/imageUtils', () => ({ convertToPng }))

vi.mock('../../utils/pathHelper', () => ({
  resolveAppPath: (...segments: string[]) => `/app/${segments.join('/')}`,
}))

describe('fallbackScreensService', () => {
  let service: FallbackScreensService
  const target = { model: V2, palette: GRAY_16 }

  beforeEach(() => {
    vi.resetAllMocks()
    service = new FallbackScreensService({ get: () => 'http://api' } as any)
  })

  it('generates the placeholder for the target when it does not exist yet', async () => {
    statMock.mockRejectedValue(new Error('ENOENT'))
    convertToPng.mockResolvedValue(undefined)

    const url = await service.urlFor('noScreen', target)

    expect(mkdirMock).toHaveBeenCalledWith('/app/public/screens/fallback/v2-gray-16', { recursive: true })
    expect(convertToPng).toHaveBeenCalledWith('/app/public/screens/noScreen.png', '/app/public/screens/fallback/v2-gray-16/noScreen.png', target, expect.any(Object))
    expect(url).toBe('http://api/screens/fallback/v2-gray-16/noScreen.png')
  })

  it('reuses an existing placeholder that is newer than the source image', async () => {
    statMock.mockImplementation(async (p: string) => ({ mtimeMs: p.endsWith('/error.png') && !p.includes('fallback') ? 100 : 200 }))

    const url = await service.urlFor('error', target)

    expect(convertToPng).not.toHaveBeenCalled()
    expect(url).toBe('http://api/screens/fallback/v2-gray-16/error.png')
  })

  it('regenerates when the source image is newer than the cached placeholder', async () => {
    statMock.mockImplementation(async (p: string) => ({ mtimeMs: p.includes('fallback') ? 100 : 200 }))
    convertToPng.mockResolvedValue(undefined)

    await service.urlFor('welcome', target)

    expect(convertToPng).toHaveBeenCalled()
  })

  it('falls back to the static image when conversion fails', async () => {
    statMock.mockRejectedValue(new Error('ENOENT'))
    convertToPng.mockRejectedValue(new Error('magick exploded'))

    await expect(service.urlFor('error', target)).resolves.toBe('http://api/screens/error.png')
  })
})
