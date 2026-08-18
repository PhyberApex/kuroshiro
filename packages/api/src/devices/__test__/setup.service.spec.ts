import type { MockDeviceModelsService, MockFallbackScreensService } from '../../device-models/__test__/mockDeviceModelsService'
import type { Device } from '../devices.entity'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockDeviceModelsService, createMockFallbackScreensService, OG_PLUS, primeMockDeviceModelsService, primeMockFallbackScreensService, V2 } from '../../device-models/__test__/mockDeviceModelsService'
import { DeviceSetupService } from '../setup.service'

vi.mock('../../utils/generateApikey', () => ({
  default: vi.fn(() => 'mocked-api-key'),
}))
vi.mock('../../utils/generateFriendlyName', () => ({
  default: vi.fn(() => 'mocked-friendly-id'),
}))

function createMockRepo() {
  return {
    findOneBy: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
  }
}

describe('deviceSetupService', () => {
  let service: DeviceSetupService
  let deviceRepo: ReturnType<typeof createMockRepo>
  let deviceModels: MockDeviceModelsService
  let fallbackScreens: MockFallbackScreensService

  beforeEach(() => {
    deviceRepo = createMockRepo()
    deviceModels = createMockDeviceModelsService()
    fallbackScreens = createMockFallbackScreensService()
    service = new DeviceSetupService(
      deviceRepo as any,
      deviceModels as any,
      fallbackScreens as any,
    )
    vi.resetAllMocks()
    primeMockDeviceModelsService(deviceModels)
    primeMockFallbackScreensService(fallbackScreens)
  })

  const headers = { id: 'mac' }

  it('returns existing credentials if device exists', async () => {
    const device = { apikey: 'existing-key', friendlyId: 'existing-id' } as Device
    deviceRepo.findOneBy.mockResolvedValue(device)
    const result = await service.setupDevice(headers)
    expect(result.api_key).toBe('existing-key')
    expect(result.friendly_id).toBe('existing-id')
    expect(result.image_url).toBe('http://api/screens/welcome.png')
    expect(result.status).toBe(200)
    expect(result.message).toBe('Welcome to Kuroshiro')
  })

  it('creates new device and returns new credentials if device does not exist', async () => {
    const newDevice = { id: 'new', mac: 'mac', friendlyId: 'mocked-friendly-id', apikey: 'mocked-api-key' }
    deviceRepo.findOneBy.mockResolvedValue(null)
    deviceRepo.create.mockReturnValue(newDevice)
    deviceRepo.save.mockResolvedValue(newDevice)

    const result = await service.setupDevice(headers)

    expect(deviceRepo.findOneBy).toHaveBeenCalledWith({ mac: 'mac' })
    expect(deviceRepo.create).toHaveBeenCalledWith({
      mac: 'mac',
      friendlyId: 'mocked-friendly-id',
      apikey: 'mocked-api-key',
      name: 'mocked-friendly-id',
    })
    expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining(newDevice))
    expect(result.api_key).toBe('mocked-api-key')
    expect(result.friendly_id).toBe('mocked-friendly-id')
    expect(result.image_url).toBe('http://api/screens/welcome.png')
    expect(result.status).toBe(200)
    expect(result.message).toBe('Welcome to Kuroshiro')
  })

  it('serves the welcome image converted for the device render target', async () => {
    deviceRepo.findOneBy.mockResolvedValue({ apikey: 'key', friendlyId: 'id', deviceModel: V2 } as unknown as Device)
    deviceModels.renderTargetFor.mockResolvedValue({ model: V2, palette: OG_PLUS })
    fallbackScreens.urlFor.mockResolvedValue('http://api/screens/fallback/v2-gray-16/welcome.png')

    const result = await service.setupDevice(headers)

    expect(fallbackScreens.urlFor).toHaveBeenCalledWith('welcome', { model: V2, palette: OG_PLUS })
    expect(result.image_url).toBe('http://api/screens/fallback/v2-gray-16/welcome.png')
  })

  it('records the reported firmware version and model, and resolves a model when none is assigned', async () => {
    const device = { apikey: 'key', friendlyId: 'id', deviceModel: null } as unknown as Device
    deviceRepo.findOneBy.mockResolvedValue(device)
    deviceModels.assignResolvedModel.mockResolvedValue(OG_PLUS)

    await service.setupDevice({ 'id': 'mac', 'fw-version': '1.6.0', 'model': 'og' })

    expect(deviceModels.assignResolvedModel).toHaveBeenCalledWith(expect.objectContaining({ reportedModel: 'og' }))
    expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ fwVersion: '1.6.0', reportedModel: 'og' }))
  })

  it('leaves an already assigned model alone', async () => {
    const device = { apikey: 'key', friendlyId: 'id', deviceModel: OG_PLUS } as unknown as Device
    deviceRepo.findOneBy.mockResolvedValue(device)

    await service.setupDevice({ id: 'mac', model: 'x' })

    expect(deviceModels.assignResolvedModel).not.toHaveBeenCalled()
    expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ reportedModel: 'x', deviceModel: OG_PLUS }))
  })
})
