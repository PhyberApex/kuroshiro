import type { ConfigService } from '@nestjs/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GRAY_16, V2 } from '../../test/mockDeviceModelsService'
import { asService } from '../../test/mockService'
import { FALLBACK_SCREEN_TEMPLATE_VERSION } from '../fallback-screen-templates'
import { FallbackScreensService } from '../fallback-screens.service'

const { statMock, renderHtmlToPng } = vi.hoisted(() => ({
  statMock: vi.fn(),
  renderHtmlToPng: vi.fn(),
}))

vi.mock('node:fs', () => ({
  promises: { stat: statMock },
}))

vi.mock('../render-html-to-png', () => ({ renderHtmlToPng }))

vi.mock('../../utils/pathHelper', () => ({
  resolveAppPath: (...segments: string[]) => `/app/${segments.join('/')}`,
}))

describe('fallbackScreensService', () => {
  let service: FallbackScreensService
  const target = { model: V2, palette: GRAY_16 }
  const cacheDir = `/app/public/screens/fallback/v${FALLBACK_SCREEN_TEMPLATE_VERSION}/v2-gray-16`

  beforeEach(() => {
    vi.resetAllMocks()
    service = new FallbackScreensService(asService<ConfigService>({ get: () => 'http://api' }))
  })

  it('generates the placeholder for the target when it does not exist yet', async () => {
    statMock.mockRejectedValue(new Error('ENOENT'))
    renderHtmlToPng.mockResolvedValue(undefined)

    const url = await service.urlFor('noScreen', target)

    expect(renderHtmlToPng).toHaveBeenCalledWith(expect.any(String), target, `${cacheDir}/noScreen.png`, expect.any(Object))
    expect(url).toBe(`http://api/screens/fallback/v${FALLBACK_SCREEN_TEMPLATE_VERSION}/v2-gray-16/noScreen.png`)
  })

  it('reuses an existing cached placeholder', async () => {
    statMock.mockResolvedValue({})

    const url = await service.urlFor('error', target)

    expect(renderHtmlToPng).not.toHaveBeenCalled()
    expect(url).toBe(`http://api/screens/fallback/v${FALLBACK_SCREEN_TEMPLATE_VERSION}/v2-gray-16/error.png`)
  })

  it('falls back to the static image when rendering fails', async () => {
    statMock.mockRejectedValue(new Error('ENOENT'))
    renderHtmlToPng.mockRejectedValue(new Error('puppeteer exploded'))

    await expect(service.urlFor('error', target)).resolves.toBe('http://api/screens/error.png')
  })
})
