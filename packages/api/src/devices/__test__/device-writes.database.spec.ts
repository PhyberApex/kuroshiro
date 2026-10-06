import type { DeviceDetail } from 'kuroshiro-shared'
import type { DataSource } from 'typeorm'
import type { DeviceModelsService } from '../../device-models/device-models.service.js'
import type { FirmwareService } from '../../firmware/firmware.service.js'
import type { ScreensService } from '../../screens/screens.service.js'
import type { HttpTestApp } from '../../test/httpApp.js'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeviceModel } from '../../device-models/entities/device-model.entity.js'
import { Palette } from '../../device-models/entities/palette.entity.js'
import { DeviceSensorsService } from '../../device-sensors/device-sensors.service.js'
import { DeviceSensor } from '../../device-sensors/entities/device-sensor.entity.js'
import { Firmware } from '../../firmware/entities/firmware.entity.js'
import { Screen } from '../../screens/screens.entity.js'
import { createHttpTestApp } from '../../test/httpApp.js'
import { BW, createMockDeviceModelsService, GRAY_4, GRAY_16, OG_PLUS, V2 } from '../../test/mockDeviceModelsService.js'
import { asService } from '../../test/mockService.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { DeviceReadsService } from '../device-reads.service.js'
import { DevicesController } from '../devices.controller.js'
import { Device } from '../devices.entity.js'
import { DevicesService } from '../devices.service.js'

vi.mock('../../utils/fileExists.js', () => ({ fileExists: vi.fn().mockResolvedValue(true) }))

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'
const FIRMWARE_ID = '11111111-1111-4111-8111-111111111111'

describe('the Device write and delete against a real database', () => {
  let database: DataSource
  let http: HttpTestApp
  const reconvertImageScreens = vi.fn().mockResolvedValue(0)

  beforeAll(async () => {
    database = await createTestDatabase()
    const models = database.getRepository(DeviceModel)
    const palettes = database.getRepository(Palette)
    await palettes.save([BW, GRAY_4, GRAY_16])
    await models.save([OG_PLUS, V2])
    await database.getRepository(Firmware).save({ id: FIRMWARE_ID, version: '1.7.0', kind: 'custom', label: 'Mine', checksum: 'abc', compatibleModels: [], deprecated: false })

    const deviceModels = createMockDeviceModelsService()
    deviceModels.findByName.mockImplementation((name: string) => models.findOneBy({ name }))
    deviceModels.findPalette.mockImplementation((id: string) => palettes.findOneBy({ id }))
    deviceModels.supportsPalette.mockImplementation(async (model: DeviceModel, palette: Palette) => model.paletteIds.includes(palette.id))
    deviceModels.defaultPaletteFor.mockImplementation((model: DeviceModel) => palettes.findOneBy({ id: model.paletteIds[0] }))
    const firmware = asService<FirmwareService>({ findById: (id: string) => database.getRepository(Firmware).findOneBy({ id }) })

    const devices = database.getRepository(Device)
    const deviceSensors = new DeviceSensorsService(database.getRepository(DeviceSensor))
    http = await createHttpTestApp({
      controllers: [DevicesController],
      providers: [
        { provide: DeviceReadsService, useValue: new DeviceReadsService(devices, database.getRepository(Screen), deviceSensors) },
        { provide: DevicesService, useValue: new DevicesService(devices, asService<DeviceModelsService>(deviceModels), firmware, asService<ScreensService>({ reconvertImageScreens })) },
      ],
    })
  })

  beforeEach(async () => {
    reconvertImageScreens.mockClear()
    await database.getRepository(Device).createQueryBuilder().delete().execute()
  })

  afterAll(async () => {
    await http.app.close()
    await database.destroy()
  })

  async function registerDevice(overrides: Partial<Device> = {}): Promise<Device> {
    return database.getRepository(Device).save({
      name: 'Kitchen',
      friendlyId: 'KITCHEN',
      mac: 'AA:BB:CC:DD:EE:01',
      apikey: 'key',
      refreshRate: 300,
      deviceModel: OG_PLUS,
      palette: BW,
      ...overrides,
    })
  }

  function patch(id: string, body: unknown): Promise<Response> {
    return http.request(`/api/devices/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  }

  async function stored(id: string): Promise<Device> {
    return database.getRepository(Device).findOneByOrFail({ id })
  }

  describe('post', () => {
    it('answers 201 with the Device Detail of a Device that has not called in, its MAC address upper-case', async () => {
      const response = await http.postJson('/api/devices', { name: '  Hallway  ', mac: 'aa:bb:cc:dd:ee:0f' })

      expect(response.status).toBe(201)
      const created = await response.json() as DeviceDetail
      expect(created).toMatchObject({ name: 'Hallway', mac: 'AA:BB:CC:DD:EE:0F', lastSeenAt: null })
      expect(await (await http.request(`/api/devices/${created.id}`)).json()).toEqual(created)
    })

    it('refuses a MAC address already registered in another letter case with 409 device-mac-taken', async () => {
      await registerDevice({ mac: 'aa:bb:cc:dd:ee:01' })

      const response = await http.postJson('/api/devices', { name: 'Hallway', mac: 'AA:BB:CC:DD:EE:01' })

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ code: 'device-mac-taken' })
      expect(await http.request('/api/devices').then(list => list.json())).toHaveLength(1)
    })

    it.each(['', '   '])('refuses %j as a name with the field named', async (name) => {
      const response = await http.postJson('/api/devices', { name, mac: 'AA:BB:CC:DD:EE:0F' })

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'validation', fields: [{ path: 'name' }] })
    })

    it.each(['AA:BB:CC:DD:EE', 'AABBCCDDEEFF', 'GG:BB:CC:DD:EE:0F'])('refuses %j as a MAC address with the field named', async (mac) => {
      const response = await http.postJson('/api/devices', { name: 'Hallway', mac })

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'validation', fields: [{ path: 'mac' }] })
    })
  })

  describe('patch', () => {
    it('answers the whole Device Detail with only the sent field changed', async () => {
      const device = await registerDevice()
      const before = await (await http.request(`/api/devices/${device.id}`)).json() as DeviceDetail

      const response = await patch(device.id, { name: '  Pantry  ' })

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ ...before, name: 'Pantry' })
    })

    it('answers 404 device-not-found for an unknown or malformed id', async () => {
      for (const id of [UNKNOWN_ID, 'nope']) {
        const response = await patch(id, { name: 'x' })
        expect(response.status).toBe(404)
        expect(await response.json()).toMatchObject({ code: 'device-not-found' })
      }
    })

    it.each([59, 86401, 90.5])('refuses %s as a refresh rate with the field named', async (refreshRate) => {
      const device = await registerDevice()

      const response = await patch(device.id, { refreshRate })

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'validation', fields: [{ path: 'refreshRate' }] })
    })

    it.each([60, 86400])('saves %s as a refresh rate', async (refreshRate) => {
      const device = await registerDevice()

      const response = await patch(device.id, { refreshRate })

      expect(response.status).toBe(200)
      expect((await stored(device.id)).refreshRate).toBe(refreshRate)
    })

    it.each(['mac', 'friendlyId', 'fwVersion', 'rssi', 'batteryVoltage', 'userAgent', 'host'])('refuses %s', async (field) => {
      const device = await registerDevice()

      const response = await patch(device.id, { [field]: 'x' })

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'validation' })
    })

    it.each([{ name: '' }, { name: '   ' }, { name: null }, { mirrorMac: 'not-a-mac' }, { mirrorMac: null }])('refuses %j', async (body) => {
      const device = await registerDevice()

      expect((await patch(device.id, body)).status).toBe(400)
    })

    it('upper-cases the mirror MAC and never answers the mirror API key', async () => {
      const device = await registerDevice()

      const response = await patch(device.id, { mirrorMac: 'aa:bb:cc:dd:ee:99', mirrorApikey: 'secret', mirrorEnabled: true })

      const body = await response.json() as DeviceDetail
      expect(body.mirror).toEqual({ enabled: true, mac: 'AA:BB:CC:DD:EE:99', apikeySet: true })
      expect(JSON.stringify(body)).not.toContain('secret')
    })

    it('shows a triggered Special Function and Device Reset as pending', async () => {
      const device = await registerDevice({ specialFunction: 'none' })

      const response = await patch(device.id, { specialFunction: 'rewind', resetDevice: true })

      expect(((await response.json()) as DeviceDetail).pending).toEqual({ specialFunction: 'rewind', deviceReset: true, deviceResetNewApikey: false, firmwarePush: false })
    })

    it('resets the Palette to the richest of a new Device Model and converts stored images again', async () => {
      const device = await registerDevice()

      const response = await patch(device.id, { deviceModelName: 'v2' })

      const body = await response.json() as DeviceDetail
      expect(body.deviceModel?.name).toBe('v2')
      expect(body.palette?.id).toBe('gray-16')
      expect(reconvertImageScreens).toHaveBeenCalledOnce()
    })

    it('refuses a Palette the Device Model does not support', async () => {
      const device = await registerDevice()

      expect((await patch(device.id, { paletteId: 'gray-16' })).status).toBe(400)
    })

    describe('firmware', () => {
      it('refuses a push for a Device without a target and stores nothing', async () => {
        const device = await registerDevice()

        const response = await patch(device.id, { updateFirmware: true })

        expect(response.status).toBe(409)
        expect(await response.json()).toMatchObject({ code: 'firmware-push-without-target' })
        expect((await stored(device.id)).updateFirmware).toBe(false)
      })

      it('saves a push sent together with a target', async () => {
        const device = await registerDevice()

        const response = await patch(device.id, { updateFirmware: true, targetFirmwareId: FIRMWARE_ID })

        expect(response.status).toBe(200)
        expect(((await response.json()) as DeviceDetail).pending.firmwarePush).toBe(true)
      })

      it('refuses a push for a mirrored Device and stores nothing', async () => {
        const device = await registerDevice({ mirrorEnabled: true, mirrorMac: 'AA:BB:CC:DD:EE:99', mirrorApikey: 'k', targetFirmware: await database.getRepository(Firmware).findOneByOrFail({ id: FIRMWARE_ID }) })

        const response = await patch(device.id, { updateFirmware: true })

        expect(response.status).toBe(409)
        expect(await response.json()).toMatchObject({ code: 'firmware-push-mirrored' })
        expect((await stored(device.id)).updateFirmware).toBe(false)
      })

      it('clears the target when no push is pending', async () => {
        const device = await registerDevice({ targetFirmware: await database.getRepository(Firmware).findOneByOrFail({ id: FIRMWARE_ID }) })

        const response = await patch(device.id, { targetFirmwareId: null })

        expect(response.status).toBe(200)
        expect(((await response.json()) as DeviceDetail).targetFirmware).toBeNull()
      })

      it('refuses to clear the target while a push is pending', async () => {
        const device = await registerDevice({ updateFirmware: true, targetFirmware: await database.getRepository(Firmware).findOneByOrFail({ id: FIRMWARE_ID }) })

        const response = await patch(device.id, { targetFirmwareId: null })

        expect(response.status).toBe(409)
        expect(await response.json()).toMatchObject({ code: 'firmware-push-pending' })
        expect((await stored(device.id)).targetFirmware?.id).toBe(FIRMWARE_ID)
      })

      it('refuses to clear the target while a push is pending even when the same request withdraws the push', async () => {
        const device = await registerDevice({ updateFirmware: true, targetFirmware: await database.getRepository(Firmware).findOneByOrFail({ id: FIRMWARE_ID }) })

        const response = await patch(device.id, { targetFirmwareId: null, updateFirmware: false })

        expect(response.status).toBe(409)
        expect(await response.json()).toMatchObject({ code: 'firmware-push-pending' })
      })
    })

    describe('resetDeviceNewApikey', () => {
      it('rides on resetDevice and shows as pending', async () => {
        const device = await registerDevice()

        const response = await patch(device.id, { resetDevice: true, resetDeviceNewApikey: true })

        expect(response.status).toBe(200)
        expect(((await response.json()) as DeviceDetail).pending).toMatchObject({ deviceReset: true, deviceResetNewApikey: true })
        expect((await stored(device.id)).resetDeviceNewApikey).toBe(true)
      })

      it('is cleared together with resetDevice when the Reset is cancelled', async () => {
        const device = await registerDevice({ resetDevice: true, resetDeviceNewApikey: true })

        const response = await patch(device.id, { resetDevice: false })

        expect(response.status).toBe(200)
        expect(((await response.json()) as DeviceDetail).pending).toMatchObject({ deviceReset: false, deviceResetNewApikey: false })
      })

      it('refuses it with 409 device-proxied for a Proxied Device, storing nothing', async () => {
        const device = await registerDevice({ mirrorEnabled: true, mirrorMac: 'AA:BB:CC:DD:EE:01', mirrorApikey: 'k' })

        const response = await patch(device.id, { resetDevice: true, resetDeviceNewApikey: true })

        expect(response.status).toBe(409)
        expect(await response.json()).toMatchObject({ code: 'device-proxied' })
        expect((await stored(device.id)).resetDeviceNewApikey).toBe(false)
      })
    })
  })

  describe('post apikey', () => {
    function regenerate(id: string): Promise<Response> {
      return http.request(`/api/devices/${id}/apikey`, { method: 'POST' })
    }

    it('rotates the apikey at once and answers the Device Detail with it', async () => {
      const device = await registerDevice({ apikey: 'old-key' })

      const response = await regenerate(device.id)

      expect(response.status).toBe(200)
      const body = await response.json() as DeviceDetail
      expect(body.apikey).not.toBe('old-key')
      expect((await stored(device.id)).apikey).toBe(body.apikey)
    })

    it('refuses with 409 device-proxied for a Proxied Device, leaving its apikey untouched', async () => {
      const device = await registerDevice({ apikey: 'old-key', mirrorEnabled: true, mirrorMac: 'AA:BB:CC:DD:EE:01', mirrorApikey: 'k' })

      const response = await regenerate(device.id)

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ code: 'device-proxied' })
      expect((await stored(device.id)).apikey).toBe('old-key')
    })

    it('answers 404 device-not-found for an unknown or malformed id', async () => {
      for (const id of [UNKNOWN_ID, 'nope']) {
        const response = await regenerate(id)
        expect(response.status).toBe(404)
        expect(await response.json()).toMatchObject({ code: 'device-not-found' })
      }
    })
  })

  describe('delete', () => {
    it('answers 204 and removes the Device', async () => {
      const device = await registerDevice()

      const response = await http.request(`/api/devices/${device.id}`, { method: 'DELETE' })

      expect(response.status).toBe(204)
      expect(await database.getRepository(Device).countBy({ id: device.id })).toBe(0)
    })

    it('answers 404 device-not-found for an unknown or malformed id', async () => {
      for (const id of [UNKNOWN_ID, 'nope']) {
        const response = await http.request(`/api/devices/${id}`, { method: 'DELETE' })
        expect(response.status).toBe(404)
        expect(await response.json()).toMatchObject({ code: 'device-not-found' })
      }
    })
  })
})
