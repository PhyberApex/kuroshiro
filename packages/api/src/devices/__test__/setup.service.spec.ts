import type { Device } from '../devices.entity'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DeviceSetupService } from '../setup.service'

vi.mock('../../utils/generateApikey', () => ({
  default: () => 'mocked-api-key',
}))
vi.mock('../../utils/generateFriendlyName', () => ({
  default: () => 'mocked-friendly-id',
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
  let configService: { get: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    deviceRepo = createMockRepo()
    configService = { get: vi.fn() }
    service = new DeviceSetupService(
      deviceRepo as any,
      configService as any,
    )
    vi.resetAllMocks()
  })

  const headers = { id: 'mac' }

  it('returns existing credentials if device exists', async () => {
    const device = { apikey: 'existing-key', friendlyId: 'existing-id' } as Device
    deviceRepo.findOneBy.mockResolvedValue(device)
    configService.get.mockReturnValue('http://api')
    const result = await service.setupDevice(headers)
    expect(result.api_key).toBe('existing-key')
    expect(result.friendly_id).toBe('existing-id')
    expect(result.image_url).toBe('http://api/screens/welcome.bmp')
    expect(result.status).toBe(200)
    expect(result.message).toBe('Welcome to Kuroshiro')
  })

  it('creates new device and returns new credentials if device does not exist', async () => {
    deviceRepo.findOneBy.mockResolvedValue(null)
    deviceRepo.create.mockReturnValue({ id: 'new', mac: 'mac', friendlyId: 'some-id', apikey: 'some-key' })
    deviceRepo.save.mockResolvedValue({ id: 'new', mac: 'mac', friendlyId: 'some-id', apikey: 'some-key' })
    configService.get.mockReturnValue('http://api')
    const result = await service.setupDevice(headers)
    expect(deviceRepo.save).toHaveBeenCalled()
    expect(typeof result.api_key).toBe('string')
    expect(result.api_key.length).toBeGreaterThan(0)
    expect(typeof result.friendly_id).toBe('string')
    expect(result.friendly_id.length).toBeGreaterThan(0)
    expect(result.image_url).toBe('http://api/screens/welcome.bmp')
    expect(result.status).toBe(200)
    expect(result.message).toBe('Welcome to Kuroshiro')
  })
})
