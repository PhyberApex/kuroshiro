import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Display } from '../display'
import { DeviceDisplayService } from '../display.service'

vi.mock('../utils/imageUtils', () => ({
  downloadImage: vi.fn().mockResolvedValue(undefined),
  convertToMonochromeBmp: vi.fn().mockResolvedValue(undefined),
}))

function createMockRepo() {
  return {
    findOneBy: vi.fn(),
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
    expect(result.filename).toBe('noScreen.bmp')
    expect(result.image_url).toBe('http://api/screens/noScreen.bmp')
  })

  it('cycles screens and returns next screen if not mirrored', async () => {
    const device = { ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: false }
    const filename = 'file.bmp'
    const generatedAt = new Date().toISOString()
    const dynamicFilename = `${filename}_${generatedAt}`
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
    expect(result.image_url).toBe('http://api/screens/devices/1/screen2.bmp')
  })
})
