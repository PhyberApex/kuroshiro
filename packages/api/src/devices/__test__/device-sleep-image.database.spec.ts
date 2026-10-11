import type { ConfigService } from '@nestjs/config'
import type { DeviceDetail } from 'kuroshiro-shared'
import type { DataSource } from 'typeorm'
import type { DeviceModelsService } from '../../device-models/device-models.service.js'
import type { HttpTestApp } from '../../test/httpApp.js'
import { Buffer } from 'node:buffer'
import * as fs from 'node:fs'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeviceSensorsService } from '../../device-sensors/device-sensors.service.js'
import { DeviceSensor } from '../../device-sensors/entities/device-sensor.entity.js'
import { Screen } from '../../screens/screens.entity.js'
import { createHttpTestApp } from '../../test/httpApp.js'
import { createMockDeviceModelsService, primeMockDeviceModelsService } from '../../test/mockDeviceModelsService.js'
import { asService } from '../../test/mockService.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { convertToPng } from '../../utils/imageUtils.js'
import { resolveAppPath } from '../../utils/pathHelper.js'
import { DeviceReadsService } from '../device-reads.service.js'
import { DeviceSleepImageController } from '../device-sleep-image.controller.js'
import { DeviceSleepImageService } from '../device-sleep-image.service.js'
import { Device } from '../devices.entity.js'

vi.mock('../../utils/imageUtils.js', () => ({
  convertToPng: vi.fn(),
}))

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

async function writeStandInFile(destination: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(destination), { recursive: true })
  await fs.promises.writeFile(destination, 'image')
}

describe('a Device\'s own sleep image, against a real database', () => {
  let database: DataSource
  let http: HttpTestApp
  let device: Device
  const config = { get: vi.fn() }

  beforeAll(async () => {
    database = await createTestDatabase()
    const deviceModels = createMockDeviceModelsService()
    primeMockDeviceModelsService(deviceModels)
    const devices = database.getRepository(Device)
    const deviceSensors = new DeviceSensorsService(database.getRepository(DeviceSensor))

    http = await createHttpTestApp({
      controllers: [DeviceSleepImageController],
      providers: [
        { provide: DeviceSleepImageService, useValue: new DeviceSleepImageService(devices, asService<ConfigService>(config), asService<DeviceModelsService>(deviceModels)) },
        { provide: DeviceReadsService, useValue: new DeviceReadsService(devices, database.getRepository(Screen), deviceSensors) },
      ],
    })
  })

  beforeEach(async () => {
    config.get.mockReturnValue(false)
    vi.mocked(convertToPng).mockImplementation(async (_input, output) => writeStandInFile(output))
    await database.getRepository(Device).createQueryBuilder().delete().execute()
    device = await database.getRepository(Device).save({ name: 'Kitchen', friendlyId: 'ABC123', mac: 'AA:BB:CC:DD:EE:01', apikey: 'device-secret', refreshRate: 300 })
  })

  afterEach(async () => {
    await fs.promises.rm(deviceFolder(), { recursive: true, force: true })
  })

  afterAll(async () => {
    await http.app.close()
    await database.destroy()
  })

  function deviceFolder(): string {
    return resolveAppPath('public', 'screens', 'devices', device.id)
  }

  async function filesOfDevice(): Promise<string[]> {
    return fs.promises.readdir(deviceFolder()).catch(() => [])
  }

  async function seedFiles(): Promise<void> {
    await fs.promises.mkdir(deviceFolder(), { recursive: true })
    await fs.promises.writeFile(path.join(deviceFolder(), 'sleep-image.png'), 'old-png')
    await fs.promises.writeFile(path.join(deviceFolder(), 'sleep-image.original'), 'old-original')
    await database.getRepository(Device).update({ id: device.id }, { sleepImageGeneratedAt: new Date('2026-01-01T00:00:00.000Z') })
  }

  function upload(deviceId: string, file: Blob | null = new Blob([Buffer.from('upload-bytes')])): Promise<Response> {
    const form = new FormData()
    if (file)
      form.set('file', file, 'night.jpg')
    return http.request(`/api/devices/${deviceId}/sleep-image`, { method: 'PUT', body: form })
  }

  function remove(deviceId: string): Promise<Response> {
    return http.request(`/api/devices/${deviceId}/sleep-image`, { method: 'DELETE' })
  }

  async function stored(): Promise<Device> {
    return database.getRepository(Device).findOneByOrFail({ id: device.id })
  }

  describe('pUT /api/devices/:id/sleep-image', () => {
    it('stores and converts the upload, answering the Device Detail with a sleep image URL', async () => {
      const response = await upload(device.id)

      expect(response.status).toBe(200)
      const detail: DeviceDetail = await response.json()
      expect(detail.sleepImagePath).toContain(`/screens/devices/${device.id}/sleep-image.png?v=`)
      expect(await fs.promises.readFile(path.join(deviceFolder(), 'sleep-image.png'), 'utf8')).toBe('image')
      expect(await fs.promises.readFile(path.join(deviceFolder(), 'sleep-image.original'), 'utf8')).toBe('upload-bytes')
      expect((await stored()).sleepImageGeneratedAt).toEqual(expect.any(Date))
      expect(await filesOfDevice()).toHaveLength(2)
    })

    it('replacing an existing sleep image changes its cache-busting version', async () => {
      await seedFiles()
      const before = (await stored()).sleepImageGeneratedAt

      const response = await upload(device.id)

      const after: DeviceDetail = await response.json()
      expect(after.sleepImagePath).not.toContain(`v=${before!.getTime()}`)
      expect(await fs.promises.readFile(path.join(deviceFolder(), 'sleep-image.png'), 'utf8')).toBe('image')
    })

    it('answers 400 image-unreadable and keeps the previous image when the conversion fails', async () => {
      await seedFiles()
      vi.mocked(convertToPng).mockRejectedValue(new Error('Unsupported or unrecognised image format'))

      const response = await upload(device.id)

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'image-unreadable' })
      expect(await fs.promises.readFile(path.join(deviceFolder(), 'sleep-image.png'), 'utf8')).toBe('old-png')
      expect(await fs.promises.readFile(path.join(deviceFolder(), 'sleep-image.original'), 'utf8')).toBe('old-original')
      expect((await stored()).sleepImageGeneratedAt).toEqual(new Date('2026-01-01T00:00:00.000Z'))
      expect(await filesOfDevice()).toHaveLength(2)
    })

    it('answers 403 demo-mode in demo mode, storing nothing', async () => {
      config.get.mockImplementation((key: string) => key === 'demo_mode')

      const response = await upload(device.id)

      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({ code: 'demo-mode' })
      expect(await filesOfDevice()).toEqual([])
    })

    it('answers 400 validation without a file, naming the part', async () => {
      const response = await upload(device.id, null)

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'validation', fields: [{ path: 'file' }] })
    })

    it('answers 404 device-not-found for an unknown Device', async () => {
      const response = await upload(UNKNOWN_ID)

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ code: 'device-not-found' })
    })
  })

  describe('dELETE /api/devices/:id/sleep-image', () => {
    it('deletes both files and answers the Device Detail with no sleep image', async () => {
      await seedFiles()

      const response = await remove(device.id)

      expect(response.status).toBe(200)
      const detail: DeviceDetail = await response.json()
      expect(detail.sleepImagePath).toBeNull()
      expect(await filesOfDevice()).toEqual([])
      expect((await stored()).sleepImageGeneratedAt).toBeNull()
    })

    it('is a no-op, not an error, for a Device with no sleep image', async () => {
      const response = await remove(device.id)

      expect(response.status).toBe(200)
      expect(((await response.json()) as DeviceDetail).sleepImagePath).toBeNull()
    })

    it('answers 404 device-not-found for an unknown Device', async () => {
      const response = await remove(UNKNOWN_ID)

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ code: 'device-not-found' })
    })
  })
})
