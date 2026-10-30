import type { ConfigService } from '@nestjs/config'
import type { DataSource } from 'typeorm'
import type { DeviceModelsService } from '../../device-models/device-models.service.js'
import type { FallbackScreensService } from '../../device-models/fallback-screens.service.js'
import type { FirmwareService } from '../../firmware/firmware.service.js'
import type { ScreenRenderService } from '../../mashup/services/screen-render.service.js'
import type { PluginRendererService } from '../../plugins/services/plugin-renderer.service.js'
import type { MockFallbackScreensService } from '../../test/mockDeviceModelsService.js'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeviceModel } from '../../device-models/entities/device-model.entity.js'
import { Palette } from '../../device-models/entities/palette.entity.js'
import { DeviceSensorsService } from '../../device-sensors/device-sensors.service.js'
import { DeviceSensor } from '../../device-sensors/entities/device-sensor.entity.js'
import { Firmware } from '../../firmware/entities/firmware.entity.js'
import { Screen } from '../../screens/screens.entity.js'
import { BW, createMockDeviceModelsService, createMockFallbackScreensService, GRAY_4, OG_PLUS, primeMockDeviceModelsService, primeMockFallbackScreensService } from '../../test/mockDeviceModelsService.js'
import { createPluginTemplateContextService } from '../../test/mockPluginCollaborators.js'
import { asService } from '../../test/mockService.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { Device } from '../devices.entity.js'
import { DeviceDisplayService } from '../display.service.js'

const OLD_FIRMWARE_ID = '11111111-1111-4111-8111-111111111111'
const NEW_FIRMWARE_ID = '22222222-2222-4222-8222-222222222222'

describe('the one-shot commands a /display poll fires, against a real database', () => {
  let database: DataSource
  let service: DeviceDisplayService
  let fallbackScreens: MockFallbackScreensService

  beforeAll(async () => {
    database = await createTestDatabase()
    await database.getRepository(Palette).save([BW, GRAY_4])
    await database.getRepository(DeviceModel).save(OG_PLUS)
    for (const [id, version] of [[OLD_FIRMWARE_ID, '1.7.0'], [NEW_FIRMWARE_ID, '1.7.1']])
      await database.getRepository(Firmware).save({ id, version, kind: 'custom', label: version, checksum: 'abc', compatibleModels: [], deprecated: false })
    const deviceModels = createMockDeviceModelsService()
    primeMockDeviceModelsService(deviceModels)
    fallbackScreens = createMockFallbackScreensService()
    service = new DeviceDisplayService(
      database.getRepository(Device),
      database.getRepository(Screen),
      asService<ConfigService>({ get: () => 'http://api' }),
      asService<DeviceModelsService>(deviceModels),
      asService<FallbackScreensService>(fallbackScreens),
      asService<FirmwareService>({ verifyChecksum: vi.fn().mockResolvedValue(true), fileUrl: (id: string) => `http://api/firmware/${id}.bin` }),
      asService<PluginRendererService>({}),
      new DeviceSensorsService(database.getRepository(DeviceSensor)),
      createPluginTemplateContextService(),
      asService<ScreenRenderService>({}),
    )
  })

  beforeEach(async () => {
    await database.getRepository(Device).createQueryBuilder().delete().execute()
    primeMockFallbackScreensService(fallbackScreens)
  })

  afterAll(async () => {
    await database.destroy()
  })

  async function pendingDevice(): Promise<Device> {
    return database.getRepository(Device).save({
      name: 'Kitchen',
      friendlyId: 'KITCHEN',
      mac: 'AA:BB:CC:DD:EE:01',
      refreshRate: 300,
      apikey: 'old-key',
      deviceModel: OG_PLUS,
      resetDevice: true,
      resetDeviceNewApikey: true,
      specialFunction: 'sleep',
      updateFirmware: true,
      targetFirmware: await database.getRepository(Firmware).findOneByOrFail({ id: OLD_FIRMWARE_ID }),
    })
  }

  async function stored(id: string): Promise<Device> {
    return database.getRepository(Device).findOneByOrFail({ id })
  }

  it('clears every command it answered once the answer is made, and stores the new API key', async () => {
    const device = await pendingDevice()

    const answer = await service.getCurrentImage({ 'id': device.mac, 'access-token': 'old-key' })

    expect(answer).toMatchObject({ reset_firmware: true, special_function: 'sleep', update_firmware: true, firmware_url: `http://api/firmware/${OLD_FIRMWARE_ID}.bin` })
    expect(await stored(device.id)).toMatchObject({ resetDevice: false, resetDeviceNewApikey: false, specialFunction: 'none', updateFirmware: false, apikey: expect.not.stringMatching(/^old-key$/) })
  })

  it('leaves every command pending when the answer cannot be made', async () => {
    const device = await pendingDevice()
    fallbackScreens.urlFor.mockRejectedValue(new Error('Chromium crashed'))

    await expect(service.getCurrentImage({ 'id': device.mac, 'access-token': 'old-key' })).rejects.toThrow('Chromium crashed')

    expect(await stored(device.id)).toMatchObject({ resetDevice: true, resetDeviceNewApikey: true, specialFunction: 'sleep', updateFirmware: true, apikey: 'old-key' })
  })

  it('keeps a Special Function and a target Firmware an admin changed while the answer was being made', async () => {
    const device = await pendingDevice()
    const answerImage = fallbackScreens.urlFor.getMockImplementation()!
    fallbackScreens.urlFor.mockImplementation(async (...args) => {
      await database.getRepository(Device).update({ id: device.id }, { specialFunction: 'identify', targetFirmware: { id: NEW_FIRMWARE_ID } })
      return answerImage(...args)
    })

    await service.getCurrentImage({ 'id': device.mac, 'access-token': 'old-key' })

    expect(await stored(device.id)).toMatchObject({ specialFunction: 'identify', updateFirmware: true, targetFirmware: expect.objectContaining({ id: NEW_FIRMWARE_ID }) })
  })
})
