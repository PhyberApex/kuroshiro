import type { ConfigService } from '@nestjs/config'
import type { DeviceDetail, DeviceSummary } from 'kuroshiro-shared'
import type { DataSource } from 'typeorm'
import type { DeviceModelsService } from '../../device-models/device-models.service.js'
import type { FallbackScreensService } from '../../device-models/fallback-screens.service.js'
import type { FirmwareService } from '../../firmware/firmware.service.js'
import type { PluginDataResolverService } from '../../plugins/services/plugin-data-resolver.service.js'
import type { PluginRendererService } from '../../plugins/services/plugin-renderer.service.js'
import type { ScreensService } from '../../screens/screens.service.js'
import type { HttpTestApp } from '../../test/httpApp.js'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { offlineRule } from '../../alerts/rules/offline.rule.js'
import { DeviceSensorsService } from '../../device-sensors/device-sensors.service.js'
import { DeviceSensor } from '../../device-sensors/entities/device-sensor.entity.js'
import { Screen } from '../../screens/screens.entity.js'
import { createHttpTestApp } from '../../test/httpApp.js'
import { createMockDeviceModelsService, createMockFallbackScreensService, primeMockDeviceModelsService, primeMockFallbackScreensService } from '../../test/mockDeviceModelsService.js'
import { createPluginTemplateContextService } from '../../test/mockPluginCollaborators.js'
import { asService } from '../../test/mockService.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { DeviceReadsService } from '../device-reads.service.js'
import { DevicesController } from '../devices.controller.js'
import { Device } from '../devices.entity.js'
import { DevicesService } from '../devices.service.js'
import { DisplayController } from '../display.controller.js'
import { DeviceDisplayService } from '../display.service.js'
import { SetupController } from '../setup.controller.js'
import { DeviceSetupService } from '../setup.service.js'

vi.mock('../../utils/fileExists.js', () => ({ fileExists: vi.fn().mockResolvedValue(true) }))

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

describe('the Device reads against a real database', () => {
  let database: DataSource
  let http: HttpTestApp

  beforeAll(async () => {
    database = await createTestDatabase()
    const devices = database.getRepository(Device)
    const screens = database.getRepository(Screen)
    const deviceModels = createMockDeviceModelsService()
    const fallbackScreens = createMockFallbackScreensService()
    primeMockDeviceModelsService(deviceModels)
    primeMockFallbackScreensService(fallbackScreens)
    const deviceSensors = new DeviceSensorsService(database.getRepository(DeviceSensor))
    const firmware = asService<FirmwareService>({})

    http = await createHttpTestApp({
      controllers: [DevicesController, DisplayController, SetupController],
      providers: [
        { provide: DeviceReadsService, useValue: new DeviceReadsService(devices, screens, deviceSensors) },
        { provide: DevicesService, useValue: new DevicesService(devices, asService<DeviceModelsService>(deviceModels), firmware, asService<ScreensService>({})) },
        { provide: DeviceSetupService, useValue: new DeviceSetupService(devices, asService<DeviceModelsService>(deviceModels), asService<FallbackScreensService>(fallbackScreens)) },
        {
          provide: DeviceDisplayService,
          useValue: new DeviceDisplayService(
            devices,
            screens,
            asService<ConfigService>({ get: () => 'http://api' }),
            asService<DeviceModelsService>(deviceModels),
            asService<FallbackScreensService>(fallbackScreens),
            firmware,
            asService<PluginDataResolverService>({}),
            asService<PluginRendererService>({}),
            deviceSensors,
            createPluginTemplateContextService(),
          ),
        },
      ],
    })
  })

  beforeEach(async () => {
    await database.getRepository(Device).createQueryBuilder().delete().execute()
  })

  afterAll(async () => {
    await http.app.close()
    await database.destroy()
  })

  async function register(name: string, mac = 'AA:BB:CC:DD:EE:01'): Promise<Device> {
    const response = await http.postJson('/api/devices', { name, mac })
    expect(response.status).toBe(201)
    return database.getRepository(Device).findOneByOrFail({ mac })
  }

  async function addScreen(device: Device, name: string): Promise<Screen> {
    return database.getRepository(Screen).save({ type: 'file', filename: name, order: 0, isActive: false, fetchManual: false, generatedAt: new Date('2026-03-01T09:30:00.000Z'), device })
  }

  async function poll(device: Device, headers: Record<string, string> = {}): Promise<{ image_url: string, refresh_rate: number }> {
    const response = await http.request('/api/display', { headers: { 'id': device.mac, 'access-token': device.apikey, ...headers } })
    expect(response.status).toBe(200)
    return response.json()
  }

  async function readDetail(id: string): Promise<DeviceDetail> {
    const response = await http.request(`/api/devices/${id}`)
    expect(response.status).toBe(200)
    return response.json()
  }

  describe('a Device that never polled', () => {
    const waitingForFirstPoll = {
      lastSeenAt: null,
      nextPollAt: null,
      currentScreen: { kind: 'fallback', fallback: 'welcome', reason: 'neverPolled', screenId: null, imagePath: '/screens/welcome.png', servedAt: null },
    }

    it('reads as waiting for its first poll when registered by hand, and the offline Alert Rule passes over it', async () => {
      const device = await register('Kitchen')

      expect(await readDetail(device.id)).toMatchObject(waitingForFirstPoll)
      expect(offlineRule.evaluate(device, { now: new Date('2030-01-01T12:00:00'), lowBatteryPercent: 20, offlineMultiplier: 3, fetchFailureThreshold: 3 }, false)).toMatchObject({ skip: true })
    })

    it('reads as waiting for its first poll when it registered itself through setup', async () => {
      const setup = await http.request('/api/setup', { headers: { id: 'AA:BB:CC:DD:EE:02' } })
      expect(setup.status).toBe(200)
      const device = await database.getRepository(Device).findOneByOrFail({ mac: 'AA:BB:CC:DD:EE:02' })

      expect(await readDetail(device.id)).toMatchObject(waitingForFirstPoll)
    })
  })

  describe('after a poll', () => {
    it('reads the Screen that poll served as the Current Screen, and the next poll from the refresh rate served', async () => {
      const device = await register('Kitchen')
      const weather = await addScreen(device, 'Weather')

      const answer = await poll(device)
      const detail = await readDetail(device.id)

      expect(answer.image_url).toBe(`http://api/screens/devices/${device.id}/${weather.id}.png`)
      expect(detail.lastSeenAt).toEqual(expect.any(String))
      expect(detail.currentScreen).toEqual({
        kind: 'screen',
        screenId: weather.id,
        name: 'Weather',
        imagePath: `/screens/devices/${device.id}/${weather.id}.png?v=${new Date('2026-03-01T09:30:00.000Z').getTime()}`,
        renderedAt: '2026-03-01T09:30:00.000Z',
        servedAt: detail.lastSeenAt,
        paused: false,
        holding: false,
      })
      expect(new Date(detail.nextPollAt!).getTime()).toBe(new Date(detail.lastSeenAt!).getTime() + answer.refresh_rate * 1000)
      expect(detail.screenCount).toBe(1)
    })

    it('reads the no-screen Fallback Screen for a Device without Screens', async () => {
      const device = await register('Kitchen')

      await poll(device)
      const { currentScreen, lastSeenAt, screenCount } = await readDetail(device.id)

      expect(currentScreen).toMatchObject({ kind: 'fallback', fallback: 'noScreen', reason: 'noScreens', screenId: null, servedAt: lastSeenAt })
      expect(currentScreen.imagePath).toMatch(/^\/screens\/noScreen\.png\?v=\d+$/)
      expect(screenCount).toBe(0)
    })

    it('folds the Sensor readings the Device reported into the read', async () => {
      const device = await register('Kitchen')

      await poll(device, { sensors: 'make=Sensirion;model=SCD41;kind=temperature;value=21.5;unit=celsius;created_at=1735714800' })

      expect((await readDetail(device.id)).sensors).toEqual([{ kind: 'temperature', value: 21.5, unit: 'celsius' }])
    })
  })

  describe('the list, GET /api/devices', () => {
    it('lists the Devices by name whatever the case, with no secret anywhere', async () => {
      const beta = await register('beta', 'AA:BB:CC:DD:EE:01')
      await register('Alpha', 'AA:BB:CC:DD:EE:02')
      await register('charlie', 'AA:BB:CC:DD:EE:03')
      await database.getRepository(Device).update({ id: beta.id }, { mirrorEnabled: true, mirrorMac: 'AA:BB:CC:DD:EE:01', mirrorApikey: 'mirror-secret' })

      const response = await http.request('/api/devices')
      const body = await response.text()
      const summaries: DeviceSummary[] = JSON.parse(body)

      expect(summaries.map(summary => summary.name)).toEqual(['Alpha', 'beta', 'charlie'])
      expect(summaries[1]).toMatchObject({ isMirrored: true, isProxied: true })
      expect(body).not.toContain('apikey')
      expect(body).not.toContain('mirrorApikey')
      expect(body).not.toContain(beta.apikey)
      expect(body).not.toContain('mirror-secret')
    })
  })

  describe('one Device, GET /api/devices/:id', () => {
    it('reveals the Device\'s API key and never the mirror API key', async () => {
      const device = await register('Kitchen')
      await database.getRepository(Device).update({ id: device.id }, { mirrorApikey: 'mirror-secret' })

      const response = await http.request(`/api/devices/${device.id}`)
      const body = await response.text()

      expect(JSON.parse(body)).toMatchObject({ apikey: device.apikey, mirror: { enabled: false, mac: null, apikeySet: true } })
      expect(body).not.toContain('mirror-secret')
    })

    it.each([UNKNOWN_ID, 'not-an-id'])('answers 404 device-not-found for the unknown id %s', async (id) => {
      const response = await http.request(`/api/devices/${id}`)

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ statusCode: 404, code: 'device-not-found' })
    })
  })

  it('no longer answers GET /api/devices/:id/sensors', async () => {
    const device = await register('Kitchen')

    const response = await http.request(`/api/devices/${device.id}/sensors`)

    expect(response.status).toBe(404)
  })
})
