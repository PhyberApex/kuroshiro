import type { AlertsList } from 'kuroshiro-shared'
import type { DataSource } from 'typeorm'
import type { HttpTestApp } from '../../test/httpApp.js'
import type { NotificationSenderService } from '../notification-sender.service.js'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Device } from '../../devices/devices.entity.js'
import { PluginDataSource } from '../../plugins/entities/plugin-data-source.entity.js'
import { Plugin } from '../../plugins/entities/plugin.entity.js'
import { createHttpTestApp } from '../../test/httpApp.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { AlertsController } from '../alerts.controller.js'
import { AlertsService } from '../alerts.service.js'
import { Alert } from '../entities/alert.entity.js'

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'
const NOW = Date.now()
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000)

describe('the Alerts list filtered, against a real database', () => {
  let database: DataSource
  let http: HttpTestApp
  let kitchen: Device
  let bedroom: Device
  let weather: Plugin
  let calendar: Plugin

  beforeAll(async () => {
    database = await createTestDatabase()
    http = await createHttpTestApp({
      controllers: [AlertsController],
      providers: [
        { provide: AlertsService, useValue: new AlertsService(database.getRepository(Alert), {} as NotificationSenderService) },
      ],
    })
  })

  beforeEach(async () => {
    await database.getRepository(Alert).createQueryBuilder().delete().execute()
    await database.getRepository(Device).createQueryBuilder().delete().execute()
    await database.getRepository(Plugin).createQueryBuilder().delete().execute()

    const devices = database.getRepository(Device)
    kitchen = await devices.save({ name: 'Kitchen', mac: 'AA:BB:CC:DD:EE:01', apikey: 'key-1', friendlyId: 'K1' } as Device)
    bedroom = await devices.save({ name: 'Bedroom', mac: 'AA:BB:CC:DD:EE:02', apikey: 'key-2', friendlyId: 'B2' } as Device)
    weather = await savePlugin('Weather', 'Forecast API')
    calendar = await savePlugin('Calendar', 'Events API')
  })

  afterAll(async () => {
    await http.app.close()
    await database.destroy()
  })

  async function savePlugin(name: string, sourceName: string): Promise<Plugin> {
    const plugin = await database.getRepository(Plugin).save({ name } as Plugin)
    await database.getRepository(PluginDataSource).save({ name: sourceName, plugin } as PluginDataSource)
    return plugin
  }

  async function dataSourceOf(plugin: Plugin): Promise<PluginDataSource> {
    return database.getRepository(PluginDataSource).findOneByOrFail({ plugin: { id: plugin.id } })
  }

  const openDeviceAlert = (device: Device, resolvedAt: Date | null = null) =>
    database.getRepository(Alert).save({ kind: 'device-low-battery', device, openedAt: minutesAgo(120), resolvedAt })

  async function openFetchAlert(plugin: Plugin, resolvedAt: Date | null = null) {
    return database.getRepository(Alert).save({ kind: 'data-source-fetch-failing', dataSource: await dataSourceOf(plugin), openedAt: minutesAgo(120), resolvedAt })
  }

  async function readList(query = ''): Promise<AlertsList> {
    const response = await http.request(`/api/alerts${query}`)
    expect(response.status).toBe(200)
    return response.json()
  }

  async function seedEverything() {
    await openDeviceAlert(kitchen)
    await openDeviceAlert(bedroom)
    await openDeviceAlert(kitchen, minutesAgo(10))
    await openDeviceAlert(bedroom, minutesAgo(10))
    await openFetchAlert(weather)
    await openFetchAlert(calendar)
    await openFetchAlert(weather, minutesAgo(10))
    await openFetchAlert(calendar, minutesAgo(10))
  }

  it('names the Plugin on a fetch Alert and no Plugin on a Device Alert', async () => {
    await openDeviceAlert(kitchen)
    await openFetchAlert(weather)

    const { active } = await readList()

    const fetchAlert = active.find(alert => alert.kind === 'data-source-fetch-failing')
    expect(fetchAlert).toMatchObject({ pluginId: weather.id, pluginName: 'Weather', dataSourceName: 'Forecast API' })
    expect(fetchAlert?.dataSourceId).toBeDefined()
    const deviceAlert = active.find(alert => alert.kind === 'device-low-battery')
    expect(deviceAlert).toMatchObject({ deviceId: kitchen.id, deviceName: 'Kitchen' })
    expect(deviceAlert).not.toHaveProperty('pluginId')
    expect(deviceAlert).not.toHaveProperty('dataSourceId')
  })

  it('answers every Alert when no filter is given', async () => {
    await seedEverything()

    const { active, resolved } = await readList()

    expect(active).toHaveLength(4)
    expect(resolved).toHaveLength(4)
  })

  it('keeps only the named Device\'s Alerts, firing and resolved', async () => {
    await seedEverything()

    const { active, resolved } = await readList(`?deviceId=${kitchen.id}`)

    expect(active.map(alert => alert.deviceId)).toEqual([kitchen.id])
    expect(resolved.map(alert => alert.deviceId)).toEqual([kitchen.id])
  })

  it('keeps only the fetch Alerts of the named Plugin, firing and resolved', async () => {
    await seedEverything()

    const { active, resolved } = await readList(`?pluginId=${weather.id}`)

    expect(active.map(alert => alert.pluginId)).toEqual([weather.id])
    expect(resolved.map(alert => alert.pluginId)).toEqual([weather.id])
  })

  it('answers nothing when a Device and a Plugin are asked for together', async () => {
    await seedEverything()

    expect(await readList(`?deviceId=${kitchen.id}&pluginId=${weather.id}`)).toEqual({ active: [], resolved: [] })
  })

  it('applies resolvedSince to the filtered resolved Alerts', async () => {
    await openDeviceAlert(kitchen, minutesAgo(10))
    await openDeviceAlert(kitchen, minutesAgo(300))

    const { resolved } = await readList(`?deviceId=${kitchen.id}&resolvedSince=${minutesAgo(60).toISOString()}`)

    expect(resolved).toHaveLength(1)
  })

  it('caps the resolved Alerts at 50 after filtering, newest first', async () => {
    await Promise.all(Array.from({ length: 55 }, (_, index) => openDeviceAlert(kitchen, minutesAgo(index + 1))))
    await Promise.all(Array.from({ length: 5 }, () => openDeviceAlert(bedroom, minutesAgo(1))))

    const { resolved } = await readList(`?deviceId=${kitchen.id}`)

    expect(resolved).toHaveLength(50)
    expect(resolved.every(alert => alert.deviceId === kitchen.id)).toBe(true)
    const times = resolved.map(alert => Date.parse(alert.resolvedAt as string))
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('answers empty lists for a well-formed id that names nothing', async () => {
    await seedEverything()

    expect(await readList(`?deviceId=${UNKNOWN_ID}`)).toEqual({ active: [], resolved: [] })
    expect(await readList(`?pluginId=${UNKNOWN_ID}`)).toEqual({ active: [], resolved: [] })
  })

  it.each(['deviceId', 'pluginId'])('refuses a malformed %s with 400 validation', async (key) => {
    const response = await http.request(`/api/alerts?${key}=not-a-uuid`)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'validation' })
  })
})
