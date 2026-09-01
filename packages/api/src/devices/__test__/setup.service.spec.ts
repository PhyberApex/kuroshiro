import type { DeviceModelsService } from '../../device-models/device-models.service.js'
import type { FallbackScreensService } from '../../device-models/fallback-screens.service.js'
import type { Device } from '../devices.entity.js'
import type { SetupRequestHeadersDto } from '../dto/setup-request-headers.dto.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDevice } from '../../test/fixtures.js'
import { createMockDeviceModelsService, createMockFallbackScreensService, OG_PLUS, primeMockDeviceModelsService, primeMockFallbackScreensService, V2 } from '../../test/mockDeviceModelsService.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { asService } from '../../test/mockService.js'
import { DeviceSetupService } from '../setup.service.js'

vi.mock('../../utils/generateApikey.js', () => ({
  default: vi.fn(() => 'mocked-api-key'),
}))
vi.mock('../../utils/generateFriendlyName.js', () => ({
  default: vi.fn(() => 'mocked-friendly-id'),
}))

describe('deviceSetupService', () => {
  let service: DeviceSetupService
  let deviceRepo: ReturnType<typeof createMockRepository<Device>>
  let deviceModels: ReturnType<typeof createMockDeviceModelsService>
  let fallbackScreens: ReturnType<typeof createMockFallbackScreensService>

  beforeEach(() => {
    deviceRepo = createMockRepository<Device>()
    deviceModels = createMockDeviceModelsService()
    fallbackScreens = createMockFallbackScreensService()
    service = new DeviceSetupService(
      asRepository(deviceRepo),
      asService<DeviceModelsService>(deviceModels),
      asService<FallbackScreensService>(fallbackScreens),
    )
    vi.resetAllMocks()
    primeMockDeviceModelsService(deviceModels)
    primeMockFallbackScreensService(fallbackScreens)
  })

  const headers: SetupRequestHeadersDto = { id: 'mac' }

  it('returns existing credentials if device exists', async () => {
    const device = makeDevice({ apikey: 'existing-key', friendlyId: 'existing-id' })
    deviceRepo.findOneBy.mockResolvedValue(device)
    const result = await service.setupDevice(headers)
    expect(result.api_key).toBe('existing-key')
    expect(result.friendly_id).toBe('existing-id')
    expect(result.image_url).toBe('http://api/screens/welcome.png')
    expect(result.status).toBe(200)
    expect(result.message).toBe('Welcome to Kuroshiro')
  })

  it('creates new device and returns new credentials if device does not exist', async () => {
    const newDevice = makeDevice({ id: 'new', mac: 'mac', friendlyId: 'mocked-friendly-id', apikey: 'mocked-api-key', name: 'mocked-friendly-id' })
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
    deviceRepo.findOneBy.mockResolvedValue(makeDevice({ apikey: 'key', friendlyId: 'id', deviceModel: V2 }))
    deviceModels.renderTargetFor.mockResolvedValue({ model: V2, palette: OG_PLUS })
    fallbackScreens.urlFor.mockResolvedValue('http://api/screens/fallback/v2-gray-16/welcome.png')

    const result = await service.setupDevice(headers)

    expect(fallbackScreens.urlFor).toHaveBeenCalledWith('welcome', { model: V2, palette: OG_PLUS })
    expect(result.image_url).toBe('http://api/screens/fallback/v2-gray-16/welcome.png')
  })

  it('records the reported firmware version and model, and resolves a model when none is assigned', async () => {
    const device = makeDevice({ apikey: 'key', friendlyId: 'id', deviceModel: null })
    deviceRepo.findOneBy.mockResolvedValue(device)
    deviceModels.assignResolvedModel.mockResolvedValue(OG_PLUS)

    await service.setupDevice({ 'id': 'mac', 'fw-version': '1.6.0', 'model': 'og' })

    expect(deviceModels.assignResolvedModel).toHaveBeenCalledWith(expect.objectContaining({ reportedModel: 'og' }))
    expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ fwVersion: '1.6.0', reportedModel: 'og' }))
  })

  it('leaves an already assigned model alone', async () => {
    const device = makeDevice({ apikey: 'key', friendlyId: 'id', deviceModel: OG_PLUS })
    deviceRepo.findOneBy.mockResolvedValue(device)

    await service.setupDevice({ id: 'mac', model: 'x' })

    expect(deviceModels.assignResolvedModel).not.toHaveBeenCalled()
    expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ reportedModel: 'x', deviceModel: OG_PLUS }))
  })
})
