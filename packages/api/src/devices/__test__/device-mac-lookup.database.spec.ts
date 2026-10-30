import type { DataSource, Repository } from 'typeorm'
import type { DeviceModelsService } from '../../device-models/device-models.service.js'
import type { FallbackScreensService } from '../../device-models/fallback-screens.service.js'
import { Logger, NotFoundException } from '@nestjs/common'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createMockDeviceModelsService, createMockFallbackScreensService, primeMockDeviceModelsService, primeMockFallbackScreensService } from '../../test/mockDeviceModelsService.js'
import { asService } from '../../test/mockService.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { authenticateDevice } from '../authenticate-device.js'
import { Device } from '../devices.entity.js'
import { DeviceSetupService } from '../setup.service.js'

describe('a Device found by the MAC it sends, against a real database', () => {
  let database: DataSource
  let devices: Repository<Device>
  let setup: DeviceSetupService
  const logger = new Logger('spec')

  beforeAll(async () => {
    database = await createTestDatabase()
    devices = database.getRepository(Device)
    const deviceModels = createMockDeviceModelsService()
    primeMockDeviceModelsService(deviceModels)
    const fallbackScreens = createMockFallbackScreensService()
    primeMockFallbackScreensService(fallbackScreens)
    setup = new DeviceSetupService(devices, asService<DeviceModelsService>(deviceModels), asService<FallbackScreensService>(fallbackScreens))
  })

  beforeEach(async () => {
    await devices.createQueryBuilder().delete().execute()
  })

  afterAll(async () => {
    await database.destroy()
  })

  function register(mac: string, apikey = 'registered-key'): Promise<Device> {
    return devices.save({ name: 'Kitchen', friendlyId: apikey, mac, apikey })
  }

  describe('/api/setup', () => {
    it('hands a Device that sends its MAC in lower case the credentials of the one registered upper-cased', async () => {
      await register('AA:BB:CC:DD:EE:FF')

      const answer = await setup.setupDevice({ id: 'aa:bb:cc:dd:ee:ff' })

      expect(answer).toMatchObject({ api_key: 'registered-key', friendly_id: 'registered-key' })
      expect(await devices.count()).toBe(1)
    })

    it('registers a new Device with its MAC upper-cased and trimmed', async () => {
      await setup.setupDevice({ id: ' aa:bb:cc:dd:ee:ff ' })

      expect(await devices.find()).toEqual([expect.objectContaining({ mac: 'AA:BB:CC:DD:EE:FF' })])
    })

    it('still finds a Device that registered itself in lower case earlier', async () => {
      await register('aa:bb:cc:dd:ee:ff')

      const answer = await setup.setupDevice({ id: 'aa:bb:cc:dd:ee:ff' })

      expect(answer.api_key).toBe('registered-key')
      expect(await devices.count()).toBe(1)
    })

    it('prefers the Device registered in exactly the case sent when an earlier setup left a case-only duplicate', async () => {
      await register('AA:BB:CC:DD:EE:FF', 'hand-registered-key')
      await register('aa:bb:cc:dd:ee:ff', 'self-registered-key')

      const answer = await setup.setupDevice({ id: 'aa:bb:cc:dd:ee:ff' })

      expect(answer.api_key).toBe('self-registered-key')
    })

    it('does not read wildcard characters in the MAC as a pattern', async () => {
      await register('AA:BB:CC:DD:EE:FF')

      const answer = await setup.setupDevice({ id: '%' })

      expect(answer.api_key).not.toBe('registered-key')
      expect(await devices.count()).toBe(2)
    })
  })

  describe('the poll authentication', () => {
    it('authenticates a Device that sends its MAC in another letter case than it was registered in', async () => {
      const device = await register('AA:BB:CC:DD:EE:FF')

      const found = await authenticateDevice(devices, { 'id': 'aa:bb:cc:dd:ee:ff', 'access-token': 'registered-key' }, logger)

      expect(found.id).toBe(device.id)
    })

    it('authenticates a Device with a case-only duplicate by the one registered in exactly the case sent', async () => {
      await register('AA:BB:CC:DD:EE:FF', 'hand-registered-key')
      const selfRegistered = await register('aa:bb:cc:dd:ee:ff', 'self-registered-key')

      const found = await authenticateDevice(devices, { 'id': 'aa:bb:cc:dd:ee:ff', 'access-token': 'self-registered-key' }, logger)

      expect(found.id).toBe(selfRegistered.id)
    })

    it('does not find a Device by a MAC made of wildcard characters', async () => {
      await register('AA:BB:CC:DD:EE:FF')

      await expect(authenticateDevice(devices, { 'id': '%', 'access-token': 'registered-key' }, logger)).rejects.toBeInstanceOf(NotFoundException)
    })
  })
})
