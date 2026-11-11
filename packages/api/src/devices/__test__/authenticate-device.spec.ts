import type { Device } from '../devices.entity.js'
import { Logger, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { authenticateDevice } from '../authenticate-device.js'

const MAC = 'AA:BB:CC:DD:EE:FF'
const API_KEY = 'right-device-api-key'

describe('authenticateDevice', () => {
  let devices: ReturnType<typeof createMockRepository<Device>>
  const logger = new Logger('spec')

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
    devices = createMockRepository<Device>()
    devices.findOneBy.mockResolvedValue({ mac: MAC, apikey: API_KEY } as Device)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function authenticate(accessToken: string | undefined) {
    return authenticateDevice(asRepository(devices), { 'id': MAC, 'access-token': accessToken }, logger)
  }

  it('accepts the Device API key', async () => {
    await expect(authenticate(API_KEY)).resolves.toMatchObject({ mac: MAC })
  })

  it('refuses a wrong key of the same length', async () => {
    await expect(authenticate(API_KEY.replace('right', 'wrong'))).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it.each([
    ['shorter', API_KEY.slice(0, -1)],
    ['longer', `${API_KEY}x`],
    ['empty', ''],
  ])('refuses a %s key', async (_, key) => {
    await expect(authenticate(key)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('refuses a request with no key', async () => {
    await expect(authenticate(undefined)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('answers Device not found for an unknown MAC', async () => {
    devices.findOneBy.mockResolvedValue(null)
    await expect(authenticate(API_KEY)).rejects.toBeInstanceOf(NotFoundException)
  })
})
