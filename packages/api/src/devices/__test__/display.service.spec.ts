import { promises as fs } from 'node:fs'
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Display } from '../display'
import { DeviceDisplayService } from '../display.service'
import { DisplayScreen } from '../displayScreen'

const { fileExists } = vi.hoisted(() => ({
  fileExists: vi.fn(),
}))

vi.mock('../../utils/fileExists', () => ({
  fileExists,
}))

vi.mock('node:fs', () => ({
  promises: {
    unlink: vi.fn(),
  },
}))

vi.mock('../../utils/imageUtils', () => ({
  downloadImage: vi.fn().mockResolvedValue(undefined),
  convertToPng: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        setViewport: vi.fn().mockResolvedValue(undefined),
        setContent: vi.fn().mockResolvedValue(undefined),
        screenshot: vi.fn().mockResolvedValue(new Uint8Array()),
      }),
    }),
  },
}))

const mockFetch = vi.fn()
globalThis.fetch = mockFetch

function createMockRepo() {
  return {
    findOneBy: vi.fn(),
    findOne: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
  }
}

describe('deviceDisplayService', () => {
  let service: DeviceDisplayService
  let deviceRepo: ReturnType<typeof createMockRepo>
  let screenRepo: ReturnType<typeof createMockRepo>
  let configService: { get: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    deviceRepo = createMockRepo()
    screenRepo = createMockRepo()
    configService = { get: vi.fn() }
    service = new DeviceDisplayService(
      deviceRepo as any,
      screenRepo as any,
      configService as any,
    )
    vi.resetAllMocks()
  })

  const baseDevice = {
    id: '1',
    mac: 'mac',
    apikey: 'token',
    refreshRate: 60,
    resetDevice: false,
    updateFirmware: false,
    specialFunction: 'identify',
    mirrorEnabled: false,
    width: undefined,
    height: undefined,
  }

  const headers = { 'id': 'mac', 'access-token': 'token' }

  it('throws NotFoundException if device not found', async () => {
    deviceRepo.findOneBy.mockResolvedValue(null)
    await expect(service.getCurrentImage(headers as any)).rejects.toThrow(NotFoundException)
  })

  it('throws UnauthorizedException if API key is invalid', async () => {
    deviceRepo.findOneBy.mockResolvedValue({ ...baseDevice, apikey: 'wrong' })
    await expect(service.getCurrentImage(headers as any)).rejects.toThrow(UnauthorizedException)
  })

  it('throws BadRequestException if width or height is changed after set', async () => {
    deviceRepo.findOneBy.mockResolvedValue({ ...baseDevice, width: 100, height: 200, apikey: 'token' })
    // width changed
    await expect(service.getCurrentImage({ ...headers, width: 101 } as any)).rejects.toThrow(BadRequestException)
    // height changed
    await expect(service.getCurrentImage({ ...headers, width: 100, height: 201 } as any)).rejects.toThrow(BadRequestException)
  })

  it('returns default no screen image if no active screen and not mirrored', async () => {
    deviceRepo.findOneBy.mockResolvedValue({ ...baseDevice, apikey: 'token' })
    screenRepo.findOneBy.mockResolvedValue(null)
    configService.get.mockReturnValue('http://api')
    deviceRepo.save.mockResolvedValue(undefined)
    const result = await service.getCurrentImage(headers as any)
    expect(result).toBeInstanceOf(Display)
    expect(result.filename).toBe('noScreen.png')
    expect(result.image_url).toBe('http://api/screens/noScreen.png')
  })

  it('cycles screens and returns next screen if not mirrored', async () => {
    const device = { ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: false }
    const filename = 'file.png'
    const generatedAt = new Date()
    const dynamicFilename = `${filename}_${generatedAt.toISOString()}`
    const activeScreen = { id: 'screen1', order: 1, device, isActive: true, fetchManual: false, externalLink: null, filename, generatedAt }
    const nextScreen = { ...activeScreen, id: 'screen2', order: 2, isActive: false }
    deviceRepo.findOneBy.mockResolvedValue(device)
    screenRepo.findOneBy
      .mockResolvedValueOnce(activeScreen) // activeScreen
      .mockResolvedValueOnce(nextScreen) // nextScreen
    screenRepo.update.mockResolvedValue(undefined)
    screenRepo.save.mockResolvedValue(nextScreen)
    configService.get.mockReturnValue('http://api')
    deviceRepo.save.mockResolvedValue(undefined)
    const result = await service.getCurrentImage(headers as any)
    expect(result).toBeInstanceOf(Display)
    expect(result.filename).toBe(dynamicFilename)
    expect(result.image_url).toBe('http://api/screens/devices/1/screen2.png')
  })

  it('processes external link images when fetchManual is false', async () => {
    const device = { ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: false }
    const activeScreen = {
      id: 'screen1',
      order: 1,
      device,
      isActive: true,
      externalLink: 'http://example.com/image.jpg',
      fetchManual: false,
      filename: 'test.png',
      generatedAt: new Date(),
    }
    const nextScreen = { ...activeScreen, id: 'screen2', order: 2, isActive: false }

    deviceRepo.findOneBy.mockResolvedValue(device)
    screenRepo.findOneBy
      .mockResolvedValueOnce(activeScreen)
      .mockResolvedValueOnce(nextScreen)
    configService.get.mockReturnValue('http://api')

    const result = await service.getCurrentImage(headers as any)
    expect(result).toBeInstanceOf(Display)
    expect(result.image_url).toBe('http://api/screens/devices/1/screen2.png')
  })

  it('handles mirroring with proxy when MACs are identical', async () => {
    const device = {
      ...baseDevice,
      apikey: 'token',
      id: '1',
      width: 800,
      height: 480,
      mirrorEnabled: true,
      mirrorMac: 'mac',
      mirrorApikey: 'mirror-token',
    }

    const testHeaders = { ...headers, width: 800, height: 480 }

    deviceRepo.findOneBy.mockResolvedValue(device)
    configService.get.mockReturnValue('http://api')

    const mockResponse = {
      filename: 'mirror.png',
      image_url: 'http://example.com/image.jpg',
      refresh_rate: 30,
      firmware_url: 'http://example.com/firmware',
      reset_firmware: true,
      special_function: 'test',
      update_firmware: true,
    }

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    })

    const { downloadImage, convertToPng } = await import('../../utils/imageUtils')

    vi.mocked(fs.unlink).mockResolvedValueOnce()
    const result = await service.getCurrentImage(testHeaders as any)
    expect(result).toBeInstanceOf(Display)
    expect(result.filename).toBe('mirror.png')
    expect(result.image_url).toContain('mirror.png')
    expect(result.refresh_rate).toBe(30)
    expect(result.firmware_url).toBe('http://example.com/firmware')
    expect(downloadImage).toHaveBeenCalledWith('http://example.com/image.jpg', expect.any(String), expect.any(Object))
    expect(convertToPng).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('mirror.png'), 800, 480, expect.any(Object))
    expect(fs.unlink).toHaveBeenCalled()
  })

  it('handles mirroring without proxy when MACs are different', async () => {
    const device = {
      ...baseDevice,
      apikey: 'token',
      id: '1',
      width: 800,
      height: 480,
      mirrorEnabled: true,
      mirrorMac: 'different-mac',
      mirrorApikey: 'mirror-token',
    }

    const testHeaders = { ...headers, width: 800, height: 480 }

    deviceRepo.findOneBy.mockResolvedValue(device)
    configService.get.mockReturnValue('http://api')

    const mockResponse = {
      filename: 'mirror.png',
      image_url: 'http://example.com/image.jpg',
    }

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    })

    const { downloadImage, convertToPng } = await import('../../utils/imageUtils')

    vi.mocked(fs.unlink).mockResolvedValueOnce()
    const result = await service.getCurrentImage(testHeaders as any)
    expect(result).toBeInstanceOf(Display)
    expect(result.filename).toBe('mirror.png')
    expect(result.image_url).toContain('mirror.png')
    expect(result.refresh_rate).toBe(device.refreshRate)
    expect(downloadImage).toHaveBeenCalledWith('http://example.com/image.jpg', expect.any(String), expect.any(Object))
    expect(convertToPng).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('mirror.png'), 800, 480, expect.any(Object))
    expect(fs.unlink).toHaveBeenCalled()
  })

  describe('getCurrentImageWithoutProgressing', () => {
    it('throws NotFoundException if device not found', async () => {
      deviceRepo.findOneBy.mockResolvedValue(null)
      await expect(service.getCurrentImageWithoutProgressing(headers)).rejects.toThrow(NotFoundException)
    })

    it('throws UnauthorizedException if API key is invalid', async () => {
      deviceRepo.findOneBy.mockResolvedValue({ ...baseDevice, apikey: 'wrong' })
      await expect(service.getCurrentImageWithoutProgressing(headers)).rejects.toThrow(UnauthorizedException)
    })

    it('returns default no screen image if no active screen and not mirrored', async () => {
      deviceRepo.findOneBy.mockResolvedValue({ ...baseDevice, apikey: 'token' })
      screenRepo.findOneBy.mockResolvedValue(null)
      configService.get.mockReturnValue('http://api')

      const result = await service.getCurrentImageWithoutProgressing(headers)
      expect(result).toBeInstanceOf(DisplayScreen)
      expect(result.filename).toBe('noScreen.png')
      expect(result.image_url).toBe('http://api/screens/noScreen.png')
      expect(result.rendered_at).toBeInstanceOf(Date)
    })

    it('returns mirror image if device is mirrored and file exists', async () => {
      const device = { ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: true }
      deviceRepo.findOneBy.mockResolvedValue(device)
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(true)

      const result = await service.getCurrentImageWithoutProgressing(headers)
      expect(fileExists).toHaveBeenCalled()
      expect(result).toBeInstanceOf(DisplayScreen)
      expect(result.filename).toContain('mirror')
      expect(result.image_url).toBe('http://api/screens/devices/1/mirror.png')
      expect(result.rendered_at).toBeUndefined()
    })

    it('returns error image if device is mirrored but file does not exist', async () => {
      const device = { ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: true }
      deviceRepo.findOneBy.mockResolvedValue(device)
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(false)

      const result = await service.getCurrentImageWithoutProgressing(headers)
      expect(result).toBeInstanceOf(DisplayScreen)
      expect(result.filename).toContain('mirror')
      expect(result.image_url).toBe('http://api/screens/error.png')
      expect(result.rendered_at).toBeUndefined()
    })

    it('returns active screen image if not mirrored', async () => {
      const device = { ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: false }
      const activeScreen = {
        id: 'screen1',
        filename: 'test.png',
        generatedAt: new Date(),
        isActive: true,
      }

      deviceRepo.findOneBy.mockResolvedValue(device)
      screenRepo.findOneBy.mockResolvedValue(activeScreen)
      configService.get.mockReturnValue('http://api')

      const result = await service.getCurrentImageWithoutProgressing(headers)
      expect(result).toBeInstanceOf(DisplayScreen)
      expect(result.filename).toBe(`${activeScreen.filename}_${activeScreen.generatedAt.toISOString()}`)
      expect(result.image_url).toBe(`http://api/screens/devices/1/screen1.png`)
      expect(result.rendered_at).toBe(activeScreen.generatedAt)
    })
  })
})
