import type { ScreenRead } from 'kuroshiro-shared'
import type { DataSource, DeepPartial } from 'typeorm'
import type { HttpTestApp } from '../../test/httpApp.js'
import { ConfigService } from '@nestjs/config'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Alert } from '../../alerts/entities/alert.entity.js'
import { Device } from '../../devices/devices.entity.js'
import { MashupConfiguration } from '../../mashup/entities/mashup-configuration.entity.js'
import { MashupSlot } from '../../mashup/entities/mashup-slot.entity.js'
import { PluginDataSource } from '../../plugins/entities/plugin-data-source.entity.js'
import { PluginFieldValue } from '../../plugins/entities/plugin-field-value.entity.js'
import { PluginField } from '../../plugins/entities/plugin-field.entity.js'
import { Plugin } from '../../plugins/entities/plugin.entity.js'
import { PluginFieldValuesService } from '../../plugins/services/plugin-field-values.service.js'
import { Schedule } from '../../schedule/schedule.entity.js'
import { createHttpTestApp } from '../../test/httpApp.js'
import { asService } from '../../test/mockService.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { fileExists } from '../../utils/fileExists.js'
import { DeviceScreensController } from '../device-screens.controller.js'
import { ScreenReadsService } from '../screen-reads.service.js'
import { ScreensController } from '../screens.controller.js'
import { Screen } from '../screens.entity.js'
import { ScreensService } from '../screens.service.js'

vi.mock('../../utils/fileExists.js', () => ({ fileExists: vi.fn() }))

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'
const CREATED_AT = new Date('2026-03-01T09:30:00.000Z')

describe('a Device\'s Screens, GET /api/devices/:id/screens, against a real database', () => {
  let database: DataSource
  let http: HttpTestApp
  let device: Device

  beforeAll(async () => {
    database = await createTestDatabase()
    const fieldValues = new PluginFieldValuesService(database.getRepository(PluginFieldValue), database.getRepository(PluginField))
    const screenReads = new ScreenReadsService(database.getRepository(Screen), database.getRepository(Device), database.getRepository(Alert), fieldValues)

    http = await createHttpTestApp({
      controllers: [DeviceScreensController, ScreensController],
      providers: [
        { provide: ScreenReadsService, useValue: screenReads },
        { provide: ScreensService, useValue: asService<ScreensService>({}) },
        { provide: ConfigService, useValue: asService<ConfigService>({}) },
      ],
    })
  })

  beforeEach(async () => {
    vi.mocked(fileExists).mockResolvedValue(true)
    await database.getRepository(Plugin).createQueryBuilder().delete().execute()
    await database.getRepository(Device).createQueryBuilder().delete().execute()
    device = await database.getRepository(Device).save({ name: 'Kitchen', friendlyId: 'ABC123', mac: 'AA:BB:CC:DD:EE:01', apikey: 'device-secret', refreshRate: 300 })
  })

  afterAll(async () => {
    await http.app.close()
    await database.destroy()
  })

  async function addScreen(order: number, overrides: DeepPartial<Screen> = {}): Promise<Screen> {
    return database.getRepository(Screen).save({ type: 'html', filename: `Screen ${order}`, html: '<p>Hi</p>', order, isActive: false, fetchManual: false, generatedAt: CREATED_AT, device, ...overrides })
  }

  async function addSchedule(screen: Screen, overrides: DeepPartial<Schedule>): Promise<Schedule> {
    return database.getRepository(Schedule).save({ enabled: true, screen, ...overrides })
  }

  async function addPlugin(name: string, overrides: DeepPartial<Plugin> = {}): Promise<Plugin> {
    return database.getRepository(Plugin).save({ name, ...overrides })
  }

  async function readScreens(): Promise<ScreenRead[]> {
    const response = await http.request(`/api/devices/${device.id}/screens`)
    expect(response.status).toBe(200)
    return response.json()
  }

  it('answers the Screens in Order with every key present', async () => {
    await addScreen(2, { filename: 'Second' })
    const first = await addScreen(1, { filename: 'First', isActive: true })

    const screens = await readScreens()

    expect(screens.map(screen => screen.name)).toEqual(['First', 'Second'])
    expect(screens[0]).toEqual({
      id: first.id,
      deviceId: device.id,
      kind: 'html',
      name: 'First',
      order: 1,
      state: 'active',
      stateCause: null,
      renderSignal: null,
      imagePath: `/screens/devices/${device.id}/${first.id}.png?v=${CREATED_AT.getTime()}`,
      renderedAt: '2026-03-01T09:30:00.000Z',
      schedule: null,
      plugin: null,
      mashup: null,
      external: null,
      file: null,
      html: '<p>Hi</p>',
    })
    expect(screens[1]).toMatchObject({ state: 'upNext', renderSignal: null })
  })

  it('carries a Screen\'s remembered Render Signal, and the Screen State it causes', async () => {
    await addScreen(1, { renderSignal: 'skip' })

    const screens = await readScreens()

    expect(screens[0]).toMatchObject({ state: 'skipping', renderSignal: 'skip' })
  })

  it('answers an empty list for a Device without Screens', async () => {
    expect(await readScreens()).toEqual([])
  })

  it.each([UNKNOWN_ID, 'not-an-id'])('answers 404 device-not-found for the unknown Device %s', async (id) => {
    const response = await http.request(`/api/devices/${id}/screens`)

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ statusCode: 404, code: 'device-not-found' })
  })

  it('derives each Screen State from the Schedules as the database stores them', async () => {
    await addScreen(1, { isActive: true })
    await addSchedule(await addScreen(2), { enabled: false })
    await addSchedule(await addScreen(3), { startDate: '2020-01-01', endDate: '2020-12-31' })
    await addScreen(4)
    await addScreen(5)

    const screens = await readScreens()

    expect(screens.map(({ state, stateCause }) => [state, stateCause])).toEqual([
      ['active', null],
      ['scheduleOff', null],
      ['notToday', 'dateRange'],
      ['upNext', null],
      [null, null],
    ])
  })

  it('reads a Schedule\'s times as HH:MM', async () => {
    await addSchedule(await addScreen(1), { weekdays: [1, 2], startTime: '06:00', endTime: '21:30' })

    const [screen] = await readScreens()

    expect(screen.schedule).toMatchObject({ enabled: true, weekdays: [1, 2], startTime: '06:00', endTime: '21:30', startDate: null, endDate: null })
  })

  it('reads every Screen of a mirrored Device without a state', async () => {
    await database.getRepository(Device).update({ id: device.id }, { mirrorEnabled: true, mirrorMac: 'AA:BB:CC:DD:EE:99', mirrorApikey: 'mirror-secret' })
    await addScreen(1, { isActive: true })
    await addSchedule(await addScreen(2), { enabled: false })
    await addScreen(3)

    const screens = await readScreens()

    expect(screens.map(({ state, stateCause }) => [state, stateCause])).toEqual([[null, null], [null, null], [null, null]])
  })

  it('reads a Screen never rendered without an image or a render time', async () => {
    vi.mocked(fileExists).mockResolvedValue(false)
    await addScreen(1)

    const [screen] = await readScreens()

    expect(screen).toMatchObject({ imagePath: null, renderedAt: null })
  })

  describe('a Plugin Screen', () => {
    it('reads a reference to its Plugin, with no whole Plugin and no secret', async () => {
      const plugin = await addPlugin('Weather', { kind: 'Webhook', webhookToken: 'webhook-secret' })
      await addScreen(1, { type: 'plugin', filename: null, html: null, plugin })

      const response = await http.request(`/api/devices/${device.id}/screens`)
      const body = await response.text()
      const [screen]: ScreenRead[] = JSON.parse(body)

      expect(screen).toMatchObject({ kind: 'plugin', name: 'Weather', html: null })
      expect(screen.plugin).toEqual({ id: plugin.id, name: 'Weather', kind: 'Webhook', requiredFieldEmpty: false, fetchAlertFiring: false })
      expect(body).not.toContain('webhook-secret')
      expect(body).not.toContain('device-secret')
    })

    it('says a required Plugin Field is empty until it has a Field Value', async () => {
      const plugin = await addPlugin('Weather')
      const field = await database.getRepository(PluginField).save({ keyname: 'city', name: 'City', fieldType: 'string', required: true, plugin })
      await addScreen(1, { type: 'plugin', filename: null, html: null, plugin })

      const [waiting] = await readScreens()
      await database.getRepository(PluginFieldValue).save({ value: 'Berlin', plugin, field })
      const [filled] = await readScreens()

      expect(waiting.plugin?.requiredFieldEmpty).toBe(true)
      expect(filled.plugin?.requiredFieldEmpty).toBe(false)
    })

    it('says a fetch Alert fires while one is open on one of the Plugin\'s Data Sources', async () => {
      const plugin = await addPlugin('Weather')
      const dataSource = await database.getRepository(PluginDataSource).save({ name: 'forecast', url: 'https://example.com', plugin })
      await addScreen(1, { type: 'plugin', filename: null, html: null, plugin })
      const alert = await database.getRepository(Alert).save({ kind: 'data-source-fetch-failing', dataSource, openedAt: new Date() })

      const [firing] = await readScreens()
      await database.getRepository(Alert).update({ id: alert.id }, { resolvedAt: new Date() })
      const [resolved] = await readScreens()

      expect(firing.plugin?.fetchAlertFiring).toBe(true)
      expect(resolved.plugin?.fetchAlertFiring).toBe(false)
    })
  })

  it('reads a Mashup Screen\'s layout and its slots in slot order', async () => {
    const clock = await addPlugin('Clock')
    const weather = await addPlugin('Weather')
    const screen = await addScreen(1, { type: 'mashup', filename: 'Morning', html: null })
    const mashupConfiguration = await database.getRepository(MashupConfiguration).save({ layout: '1Lx1R', screen })
    await database.getRepository(MashupSlot).save([
      { position: 'right', size: 'view--half_vertical', order: 1, plugin: weather, mashupConfiguration },
      { position: 'left', size: 'view--half_vertical', order: 0, plugin: clock, mashupConfiguration },
    ])

    const [read] = await readScreens()

    expect(read.mashup).toEqual({
      layout: '1Lx1R',
      slots: [
        { position: 'left', size: 'half_vertical', pluginId: clock.id, pluginName: 'Clock' },
        { position: 'right', size: 'half_vertical', pluginId: weather.id, pluginName: 'Weather' },
      ],
    })
  })

  it('reads a File Screen uploaded before its facts were stored with those facts null', async () => {
    await addScreen(1, { type: 'file', filename: 'Photo', html: null })

    const [screen] = await readScreens()

    expect(screen.file).toEqual({ originalName: null, width: null, height: null, bytes: null, uploadedAt: null })
  })

  it('reads a File Screen\'s upload time apart from its render time, which a re-conversion alone does not move', async () => {
    await addScreen(1, { type: 'file', filename: 'Photo', html: null, fileUploadedAt: new Date('2026-02-15T08:00:00.000Z') })

    const [screen] = await readScreens()

    expect(screen.file).toMatchObject({ uploadedAt: '2026-02-15T08:00:00.000Z' })
    expect(screen.renderedAt).toBe('2026-03-01T09:30:00.000Z')
  })

  it('no longer answers GET /api/screens/device/:deviceId', async () => {
    const response = await http.request(`/api/screens/device/${device.id}`)

    expect(response.status).toBe(404)
  })
})
