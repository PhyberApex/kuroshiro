import type { ConfigService } from '@nestjs/config'
import type { DataSource } from 'typeorm'
import type { DeviceModelsService } from '../../device-models/device-models.service.js'
import type { FallbackScreensService } from '../../device-models/fallback-screens.service.js'
import type { FirmwareService } from '../../firmware/firmware.service.js'
import type { ScreenRenderService } from '../../mashup/services/screen-render.service.js'
import type { PluginRendererService } from '../../plugins/services/plugin-renderer.service.js'
import type { MockDeviceModelsService, MockFallbackScreensService } from '../../test/mockDeviceModelsService.js'
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
  let deviceModels: MockDeviceModelsService
  const verifyChecksum = vi.fn<FirmwareService['verifyChecksum']>()

  beforeAll(async () => {
    database = await createTestDatabase()
    await database.getRepository(Palette).save([BW, GRAY_4])
    await database.getRepository(DeviceModel).save(OG_PLUS)
    for (const [id, version] of [[OLD_FIRMWARE_ID, '1.7.0'], [NEW_FIRMWARE_ID, '1.7.1']])
      await database.getRepository(Firmware).save({ id, version, kind: 'custom', label: version, checksum: 'abc', compatibleModels: [], deprecated: false })
    deviceModels = createMockDeviceModelsService()
    fallbackScreens = createMockFallbackScreensService()
    service = new DeviceDisplayService(
      database.getRepository(Device),
      database.getRepository(Screen),
      asService<ConfigService>({ get: () => 'http://api' }),
      asService<DeviceModelsService>(deviceModels),
      asService<FallbackScreensService>(fallbackScreens),
      asService<FirmwareService>({ verifyChecksum, fileUrl: (id: string) => `http://api/firmware/${id}.bin` }),
      asService<PluginRendererService>({}),
      new DeviceSensorsService(database.getRepository(DeviceSensor)),
      createPluginTemplateContextService(),
      asService<ScreenRenderService>({}),
    )
  })

  beforeEach(async () => {
    await database.getRepository(Device).createQueryBuilder().delete().execute()
    primeMockFallbackScreensService(fallbackScreens)
    primeMockDeviceModelsService(deviceModels)
    verifyChecksum.mockReset().mockResolvedValue(true)
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

  it('keeps what an admin changed while the poll recorded the Device\'s report', async () => {
    const device = await database.getRepository(Device).save({
      name: 'Kitchen',
      friendlyId: 'KITCHEN',
      mac: 'AA:BB:CC:DD:EE:01',
      refreshRate: 300,
      apikey: 'old-key',
      deviceModel: OG_PLUS,
      specialFunction: 'none',
      updateFirmware: true,
      targetFirmware: await database.getRepository(Firmware).findOneByOrFail({ id: OLD_FIRMWARE_ID }),
    })
    verifyChecksum.mockImplementation(async () => {
      await database.getRepository(Device).update({ id: device.id }, { name: 'Hall', apikey: 'new-key', refreshRate: 900, specialFunction: 'identify', wipe: true })
      return true
    })

    await service.getCurrentImage({ 'id': device.mac, 'access-token': 'old-key', 'fw-version': '1.7.0', 'update-source': 'EXT0' })

    expect(await stored(device.id)).toMatchObject({
      name: 'Hall',
      apikey: 'new-key',
      refreshRate: 900,
      specialFunction: 'identify',
      wipe: true,
      fwVersion: '1.7.0',
      lastWakeSource: 'EXT0',
      lastSeen: expect.any(Date),
    })
  })

  it('stores the Device Model and Palette the poll resolved for a Device without one', async () => {
    const device = await database.getRepository(Device).save({ name: 'Kitchen', friendlyId: 'KITCHEN', mac: 'AA:BB:CC:DD:EE:01', apikey: 'old-key', specialFunction: 'none' })
    deviceModels.assignResolvedModel.mockImplementation(async (polled: Device) => {
      polled.deviceModel = OG_PLUS
      polled.palette = GRAY_4
      return OG_PLUS
    })

    await service.getCurrentImage({ 'id': device.mac, 'access-token': 'old-key' })

    expect(await stored(device.id)).toMatchObject({ deviceModel: expect.objectContaining({ name: OG_PLUS.name }), palette: expect.objectContaining({ id: GRAY_4.id }) })
  })

  it('keeps a Device Model an admin assigned while a poll could not resolve one', async () => {
    const device = await database.getRepository(Device).save({ name: 'Kitchen', friendlyId: 'KITCHEN', mac: 'AA:BB:CC:DD:EE:01', apikey: 'old-key', specialFunction: 'none' })
    deviceModels.assignResolvedModel.mockImplementation(async () => {
      await database.getRepository(Device).update({ id: device.id }, { deviceModel: OG_PLUS, palette: BW })
      return null
    })

    await service.getCurrentImage({ 'id': device.mac, 'access-token': 'old-key' })

    expect(await stored(device.id)).toMatchObject({ deviceModel: expect.objectContaining({ name: OG_PLUS.name }), palette: expect.objectContaining({ id: BW.id }) })
  })
})
