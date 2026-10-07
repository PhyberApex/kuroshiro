import type { ScreenRead } from 'kuroshiro-shared'
import type { DataSource, DeepPartial } from 'typeorm'
import type { DeviceModelsService } from '../../device-models/device-models.service.js'
import type { HttpTestApp } from '../../test/httpApp.js'
import { Buffer } from 'node:buffer'
import * as fs from 'node:fs'
import path from 'node:path'
import { ConfigService } from '@nestjs/config'
import { Repository } from 'typeorm'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Alert } from '../../alerts/entities/alert.entity.js'
import { Device } from '../../devices/devices.entity.js'
import { MashupConfiguration } from '../../mashup/entities/mashup-configuration.entity.js'
import { MashupSlot } from '../../mashup/entities/mashup-slot.entity.js'
import { MashupController } from '../../mashup/mashup.controller.js'
import { MashupService } from '../../mashup/mashup.service.js'
import { DevicePlugin } from '../../plugins/entities/device-plugin.entity.js'
import { PluginFieldValue } from '../../plugins/entities/plugin-field-value.entity.js'
import { PluginField } from '../../plugins/entities/plugin-field.entity.js'
import { Plugin } from '../../plugins/entities/plugin.entity.js'
import { PluginsController } from '../../plugins/plugins.controller.js'
import { PluginsService } from '../../plugins/plugins.service.js'
import { PluginAssignmentsService } from '../../plugins/services/plugin-assignments.service.js'
import { PluginExporterService } from '../../plugins/services/plugin-exporter.service.js'
import { PluginFieldValuesService } from '../../plugins/services/plugin-field-values.service.js'
import { PluginImporterService } from '../../plugins/services/plugin-importer.service.js'
import { PluginPreviewDataService } from '../../plugins/services/plugin-preview-data.service.js'
import { PluginReadsService } from '../../plugins/services/plugin-reads.service.js'
import { RecipeUpdateService } from '../../plugins/services/recipe-update.service.js'
import { nextEligibleScreen } from '../../schedule/rotation.js'
import { createHttpTestApp } from '../../test/httpApp.js'
import { createMockDeviceModelsService, primeMockDeviceModelsService } from '../../test/mockDeviceModelsService.js'
import { asService } from '../../test/mockService.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { convertToPng, downloadImage, readImageSize } from '../../utils/imageUtils.js'
import { resolveAppPath } from '../../utils/pathHelper.js'
import { DeviceScreensController } from '../device-screens.controller.js'
import { PluginAssignmentsController } from '../plugin-assignments.controller.js'
import { ScreenReadsService } from '../screen-reads.service.js'
import { ScreensController } from '../screens.controller.js'
import { Screen } from '../screens.entity.js'
import { ScreensService } from '../screens.service.js'

vi.mock('../../utils/imageUtils.js', () => ({
  downloadImage: vi.fn(),
  convertToPng: vi.fn(),
  readImageSize: vi.fn(),
}))

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'
const CREATED_AT = new Date('2026-03-01T09:30:00.000Z')

async function writeStandInFile(destination: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(destination), { recursive: true })
  await fs.promises.writeFile(destination, 'image')
}

describe('adding, deleting and reordering a Device\'s Screens, against a real database', () => {
  let database: DataSource
  let http: HttpTestApp
  let device: Device
  let assignmentsService: PluginAssignmentsService
  const config = { get: vi.fn() }

  beforeAll(async () => {
    database = await createTestDatabase()
    // `synchronize` cannot express a deferrable constraint from a plain entity decorator; this mirrors what the migration adds in production.
    await database.query(`ALTER TABLE "screen" ADD CONSTRAINT "UQ_screen_device_order" UNIQUE ("deviceId", "order") DEFERRABLE INITIALLY DEFERRED`)
    const deviceModels = createMockDeviceModelsService()
    primeMockDeviceModelsService(deviceModels)
    const fieldValues = new PluginFieldValuesService(database.getRepository(PluginFieldValue), database.getRepository(PluginField))

    http = await createHttpTestApp({
      controllers: [ScreensController, DeviceScreensController, PluginAssignmentsController, MashupController, PluginsController],
      providers: [
        { provide: PluginsService, useValue: {} },
        { provide: PluginReadsService, useValue: {} },
        { provide: PluginPreviewDataService, useValue: {} },
        { provide: PluginImporterService, useValue: {} },
        { provide: PluginExporterService, useValue: {} },
        { provide: RecipeUpdateService, useValue: {} },
        { provide: ConfigService, useValue: asService<ConfigService>(config) },
        {
          provide: ScreenReadsService,
          useValue: new ScreenReadsService(database.getRepository(Screen), database.getRepository(Device), database.getRepository(Alert), fieldValues),
        },
        {
          provide: ScreensService,
          useValue: new ScreensService(
            database.getRepository(Screen),
            database.getRepository(Device),
            asService<ConfigService>(config),
            asService<DeviceModelsService>(deviceModels),
          ),
        },
        {
          provide: MashupService,
          useValue: new MashupService(
            database.getRepository(Screen),
            database.getRepository(Device),
            database.getRepository(MashupConfiguration),
            database.getRepository(MashupSlot),
            database.getRepository(Plugin),
          ),
        },
        {
          provide: PluginAssignmentsService,
          useValue: (assignmentsService = new PluginAssignmentsService(database.getRepository(Plugin), database.getRepository(Device), database.getRepository(DevicePlugin))),
        },
      ],
    })
  })

  beforeEach(async () => {
    config.get.mockReturnValue(false)
    vi.mocked(downloadImage).mockImplementation(async (_url, destination) => writeStandInFile(destination))
    vi.mocked(convertToPng).mockImplementation(async (_input, output) => writeStandInFile(output))
    vi.mocked(readImageSize).mockResolvedValue({ width: 1600, height: 960 })
    await database.getRepository(Plugin).createQueryBuilder().delete().execute()
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

  async function seedScreen(order: number, overrides: DeepPartial<Screen> = {}): Promise<Screen> {
    return database.getRepository(Screen).save({ type: 'html', filename: `Screen ${order}`, html: '<p>Hi</p>', order, isActive: false, fetchManual: false, generatedAt: CREATED_AT, device, ...overrides })
  }

  async function seedPlugin(name: string): Promise<Plugin> {
    return database.getRepository(Plugin).save({ name })
  }

  async function readScreens(): Promise<ScreenRead[]> {
    const response = await http.request(`/api/devices/${device.id}/screens`)
    expect(response.status).toBe(200)
    return response.json()
  }

  async function orderAndState(): Promise<Array<[string, number, ScreenRead['state']]>> {
    return (await readScreens()).map(screen => [screen.name, screen.order, screen.state])
  }

  function postHtmlScreen(overrides: Record<string, unknown> = {}): Promise<Response> {
    return http.postJson('/api/screens', { deviceId: device.id, kind: 'html', name: 'Note', html: '<p>New</p>', ...overrides })
  }

  function postFileScreen(fields: Record<string, string>, file: Blob | null = new Blob([Buffer.from('raw-upload')])): Promise<Response> {
    const form = new FormData()
    Object.entries(fields).forEach(([key, value]) => form.set(key, value))
    if (file)
      form.set('file', file, 'holiday.jpg')
    return http.request('/api/screens', { method: 'POST', body: form })
  }

  function deleteRequest(pathname: string): Promise<Response> {
    return http.request(pathname, { method: 'DELETE' })
  }

  function putOrder(screenIds: unknown, deviceId = device.id): Promise<Response> {
    return http.request(`/api/devices/${deviceId}/screens/order`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ screenIds }),
    })
  }

  const adders: Array<[string, () => Promise<Response>]> = [
    ['an External link', () => http.postJson('/api/screens', { deviceId: device.id, kind: 'external', name: 'Added', url: 'https://example.com/a.png', fetchManual: false })],
    ['a kept External link', () => http.postJson('/api/screens', { deviceId: device.id, kind: 'external', name: 'Added', url: 'https://example.com/a.png', fetchManual: true })],
    ['a File', () => postFileScreen({ deviceId: device.id, kind: 'file', name: 'Added' })],
    ['an HTML Screen', () => postHtmlScreen({ name: 'Added' })],
    ['a Mashup', async () => {
      const [left, right] = [await seedPlugin('Left'), await seedPlugin('Right')]
      return http.postJson('/api/mashup', { deviceId: device.id, name: 'Added', layout: '1Lx1R', pluginIds: [left.id, right.id] })
    }],
    ['a Plugin Assignment', async () => {
      const plugin = await seedPlugin('Added')
      return http.postJson(`/api/plugins/${plugin.id}/assign`, { deviceId: device.id })
    }],
  ]

  describe.each(adders)('adding %s', (_kind, add) => {
    it('leaves the Active Screen active and puts the new Screen last in the Order, inactive', async () => {
      await seedScreen(1, { filename: 'First', isActive: true })
      await seedScreen(2, { filename: 'Second' })

      const response = await add()

      expect(response.status).toBe(201)
      const added: ScreenRead = await response.json()
      expect(added).toMatchObject({ deviceId: device.id, name: 'Added', order: 3 })
      expect(added.state).not.toBe('active')
      const screens = await readScreens()
      expect(screens.map(screen => [screen.name, screen.order])).toEqual([['First', 1], ['Second', 2], ['Added', 3]])
      expect(screens.filter(screen => screen.state === 'active').map(screen => screen.name)).toEqual(['First'])
      expect(screens[2]).toEqual(added)
    })

    it('creates no Active Screen on a Device without Screens, so the next poll starts with it', async () => {
      const response = await add()

      expect(response.status).toBe(201)
      const stored = await database.getRepository(Screen).find({ where: { device: { id: device.id } } })
      expect(stored.map(screen => [screen.order, screen.isActive])).toEqual([[1, false]])
      expect(nextEligibleScreen(stored, new Date())?.id).toBe(stored[0].id)
    })
  })

  describe('adding a Screen, POST /api/screens', () => {
    it('answers the ScreenRead of an HTML Screen, with its name trimmed', async () => {
      const response = await postHtmlScreen({ name: '  Note  ' })

      expect(response.status).toBe(201)
      expect(await response.json()).toMatchObject({ kind: 'html', name: 'Note', html: '<p>New</p>', external: null, file: null, order: 1 })
    })

    it('answers 409 instead of a duplicate Order when another add wins a race the row lock did not prevent', async () => {
      await seedScreen(1, { filename: 'First' })
      const maximum = vi.spyOn(Repository.prototype, 'maximum')
      maximum.mockImplementationOnce(async () => {
        // The other request's add, landing between this one's lock and its own read of the maximum: what the row lock in joinEndOfOrder exists to rule out. The deferred UNIQUE constraint is the backstop if it ever doesn't.
        await seedScreen(2, { filename: 'Other' })
        return 1
      })

      const response = await postHtmlScreen({ name: 'Mine' })

      expect(response.status).toBe(409)
      expect((await readScreens()).map(screen => screen.name)).toEqual(['First', 'Other'])
      maximum.mockRestore()
    })

    it('answers the ScreenRead of an External link fetched on every poll without fetching it', async () => {
      const response = await http.postJson('/api/screens', { deviceId: device.id, kind: 'external', name: 'Cam', url: 'http://cam.local/now.jpg', fetchManual: false })

      expect(response.status).toBe(201)
      expect(await response.json()).toMatchObject({ kind: 'external', external: { url: 'http://cam.local/now.jpg', fetchManual: false } })
      expect(downloadImage).not.toHaveBeenCalled()
    })

    it('fetches and converts a kept External link before answering', async () => {
      const response = await http.postJson('/api/screens', { deviceId: device.id, kind: 'external', name: 'Poster', url: 'https://example.com/poster.png', fetchManual: true })

      const screen: ScreenRead = await response.json()
      expect(screen).toMatchObject({ kind: 'external', external: { url: 'https://example.com/poster.png', fetchManual: true } })
      expect(screen.imagePath).toContain(`/screens/devices/${device.id}/${screen.id}.png`)
      expect((await filesOfDevice()).sort()).toEqual([`${screen.id}.original`, `${screen.id}.png`])
    })

    it.each([
      ['the fetch', () => vi.mocked(downloadImage).mockRejectedValue(new Error('Failed to fetch image: Not Found')), 'Failed to fetch image: Not Found'],
      ['the conversion', () => vi.mocked(convertToPng).mockRejectedValue(new Error('Unsupported or unrecognised image format')), 'The address did not answer with an image Kuroshiro can read.'],
    ])('answers 422 image-fetch-failed with details.reason and leaves no Screen and no file behind when %s of a kept External link fails', async (_step, fail, reason) => {
      fail()

      const response = await http.postJson('/api/screens', { deviceId: device.id, kind: 'external', name: 'Poster', url: 'https://example.com/poster.png', fetchManual: true })

      expect(response.status).toBe(422)
      expect(await response.json()).toMatchObject({ statusCode: 422, code: 'image-fetch-failed', details: { reason } })
      expect(await readScreens()).toEqual([])
      expect(await filesOfDevice()).toEqual([])
    })

    it('stores the name, pixel size and byte size of a File Screen\'s upload', async () => {
      const response = await postFileScreen({ deviceId: device.id, kind: 'file', name: 'Holiday' })

      expect(response.status).toBe(201)
      const screen: ScreenRead = await response.json()
      expect(screen).toMatchObject({ kind: 'file', name: 'Holiday', file: { originalName: 'holiday.jpg', width: 1600, height: 960, bytes: 'raw-upload'.length } })
      expect(screen.imagePath).toContain(`${screen.id}.png`)
      expect(screen.file?.uploadedAt).toEqual(expect.any(String))
    })

    it('answers 400 image-unreadable and leaves no Screen and no file behind for an upload that is not an image', async () => {
      vi.mocked(readImageSize).mockRejectedValue(new Error('Unsupported or unrecognised image format'))

      const response = await postFileScreen({ deviceId: device.id, kind: 'file', name: 'Notes' })

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ statusCode: 400, code: 'image-unreadable' })
      expect(await readScreens()).toEqual([])
      expect(await filesOfDevice()).toEqual([])
    })

    it('refuses a file in demo mode with 403 demo-mode', async () => {
      config.get.mockImplementation((key: string) => key === 'demo_mode')

      const response = await postFileScreen({ deviceId: device.id, kind: 'file', name: 'Holiday' })

      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({ statusCode: 403, code: 'demo-mode' })
      expect(await readScreens()).toEqual([])
    })

    it('refuses a File Screen without a file, naming the part', async () => {
      const response = await postFileScreen({ deviceId: device.id, kind: 'file', name: 'Holiday' }, null)

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'validation', fields: [{ path: 'file' }] })
    })

    it.each([
      ['a name that is empty after trim', { name: '   ' }, 'name'],
      ['a missing kind', { kind: undefined }, 'kind'],
      ['a kind this endpoint does not create', { kind: 'mashup' }, 'kind'],
      ['the old filename key', { filename: 'Note' }, 'filename'],
      ['an HTML Screen without html', { html: undefined }, 'html'],
      ['an External link that is not http(s)', { kind: 'external', url: 'ftp://example.com/a.png', fetchManual: false }, 'url'],
      ['an External link without its fetch choice', { kind: 'external', url: 'https://example.com/a.png' }, 'fetchManual'],
    ])('answers 400 with fields for %s', async (_case, overrides, path) => {
      const response = await postHtmlScreen(overrides)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.code).toBe('validation')
      expect(body.fields.map((field: { path: string }) => field.path)).toContain(path)
      expect(await readScreens()).toEqual([])
    })

    it('answers 404 device-not-found for an unknown Device', async () => {
      const response = await postHtmlScreen({ deviceId: UNKNOWN_ID })

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ code: 'device-not-found' })
    })
  })

  describe('adding a Mashup, POST /api/mashup', () => {
    it('answers the ScreenRead of the Mashup with its slots in slot order', async () => {
      const [left, right] = [await seedPlugin('Weather'), await seedPlugin('Calendar')]

      const response = await http.postJson('/api/mashup', { deviceId: device.id, name: ' Morning ', layout: '1Lx1R', pluginIds: [left.id, right.id] })

      expect(response.status).toBe(201)
      expect(await response.json()).toMatchObject({
        kind: 'mashup',
        name: 'Morning',
        mashup: {
          layout: '1Lx1R',
          slots: [
            { position: 'left', size: 'half_vertical', pluginId: left.id, pluginName: 'Weather' },
            { position: 'right', size: 'half_vertical', pluginId: right.id, pluginName: 'Calendar' },
          ],
        },
      })
    })

    it('answers 400 for a Plugin count that does not match the layout', async () => {
      const plugin = await seedPlugin('Weather')

      const response = await http.postJson('/api/mashup', { deviceId: device.id, name: 'Morning', layout: '1Lx1R', pluginIds: [plugin.id] })

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'validation', fields: [{ path: 'pluginIds' }] })
      expect(await readScreens()).toEqual([])
    })

    it('answers 400 for a repeated Plugin', async () => {
      const plugin = await seedPlugin('Weather')

      const response = await http.postJson('/api/mashup', { deviceId: device.id, name: 'Morning', layout: '1Lx1R', pluginIds: [plugin.id, plugin.id] })

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'validation', fields: [{ path: 'pluginIds' }] })
    })

    it('answers 404 plugin-not-found for an unknown Plugin and creates nothing', async () => {
      const plugin = await seedPlugin('Weather')

      const response = await http.postJson('/api/mashup', { deviceId: device.id, name: 'Morning', layout: '1Lx1R', pluginIds: [plugin.id, UNKNOWN_ID] })

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ code: 'plugin-not-found' })
      expect(await readScreens()).toEqual([])
    })

    it.each([
      ['an unknown Device', { deviceId: UNKNOWN_ID }, 404, 'device-not-found'],
      ['an empty name', { name: ' ' }, 400, 'validation'],
      ['the old filename key', { filename: 'Morning' }, 400, 'validation'],
      ['an unknown layout', { layout: '3x3' }, 400, 'validation'],
    ])('answers for %s', async (_case, overrides, status, code) => {
      const [left, right] = [await seedPlugin('Weather'), await seedPlugin('Calendar')]

      const response = await http.postJson('/api/mashup', { deviceId: device.id, name: 'Morning', layout: '1Lx1R', pluginIds: [left.id, right.id], ...overrides })

      expect(response.status).toBe(status)
      expect(await response.json()).toMatchObject({ code })
    })
  })

  describe('assigning a Plugin, POST /api/plugins/:id/assign', () => {
    it('answers the ScreenRead of the Plugin Screen', async () => {
      const plugin = await seedPlugin('Weather')

      const response = await http.postJson(`/api/plugins/${plugin.id}/assign`, { deviceId: device.id })

      expect(response.status).toBe(201)
      expect(await response.json()).toMatchObject({ kind: 'plugin', name: 'Weather', order: 1, plugin: { id: plugin.id, name: 'Weather' } })
    })

    it('answers 404 plugin-not-found for an unknown Plugin', async () => {
      const response = await http.postJson(`/api/plugins/${UNKNOWN_ID}/assign`, { deviceId: device.id })

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ code: 'plugin-not-found' })
    })

    it('answers 404 device-not-found for an unknown Device', async () => {
      const plugin = await seedPlugin('Weather')

      const response = await http.postJson(`/api/plugins/${plugin.id}/assign`, { deviceId: UNKNOWN_ID })

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ code: 'device-not-found' })
    })

    it('answers 400 for an extra body key', async () => {
      const plugin = await seedPlugin('Weather')

      const response = await http.postJson(`/api/plugins/${plugin.id}/assign`, { deviceId: device.id, isActive: true })

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'validation', fields: [{ path: 'isActive' }] })
      expect(await readScreens()).toEqual([])
    })

    it('answers 409 plugin-already-assigned for a second assignment of the same Plugin', async () => {
      const plugin = await seedPlugin('Weather')
      await http.postJson(`/api/plugins/${plugin.id}/assign`, { deviceId: device.id })

      const response = await http.postJson(`/api/plugins/${plugin.id}/assign`, { deviceId: device.id })

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ code: 'plugin-already-assigned' })
      expect(await readScreens()).toHaveLength(1)
    })

    it('answers 409 plugin-already-assigned when a second assignment wins a race the up-front check missed, with one Screen', async () => {
      const plugin = await seedPlugin('Weather')
      const findAssignment = vi.spyOn(assignmentsService as unknown as { findAssignment: (pluginId: string, deviceId: string) => Promise<unknown> }, 'findAssignment')
      findAssignment.mockImplementationOnce(async () => {
        // The other request's full assign(), landing between this one's check and its own write.
        const assignment = await database.getRepository(DevicePlugin).save({ plugin: { id: plugin.id }, device: { id: device.id } })
        await database.getRepository(Screen).save({ type: 'plugin', devicePluginId: assignment.id, order: 1, isActive: false, fetchManual: false, generatedAt: CREATED_AT, device, plugin })
        return null
      })

      const response = await http.postJson(`/api/plugins/${plugin.id}/assign`, { deviceId: device.id })

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ code: 'plugin-already-assigned' })
      expect(await database.getRepository(DevicePlugin).count()).toBe(1)
      expect(await readScreens()).toHaveLength(1)
      findAssignment.mockRestore()
    })
  })

  describe('deleting a Screen, DELETE /api/screens/:id', () => {
    it('answers 204 and closes the gap in the Order after deleting a Mashup', async () => {
      const [left, right] = [await seedPlugin('Weather'), await seedPlugin('Calendar')]
      await seedScreen(1, { filename: 'First', isActive: true })
      const mashup: ScreenRead = await (await http.postJson('/api/mashup', { deviceId: device.id, name: 'Morning', layout: '1Lx1R', pluginIds: [left.id, right.id] })).json()
      await seedScreen(3, { filename: 'Last' })

      const response = await deleteRequest(`/api/screens/${mashup.id}`)

      expect(response.status).toBe(204)
      expect(await orderAndState()).toEqual([['First', 1, 'active'], ['Last', 2, 'upNext']])
      expect(await database.getRepository(MashupConfiguration).count()).toBe(0)
    })

    it('leaves no Active Screen after deleting the Active Screen', async () => {
      const active = await seedScreen(1, { filename: 'First', isActive: true })
      await seedScreen(2, { filename: 'Second' })
      await seedScreen(3, { filename: 'Third' })

      await deleteRequest(`/api/screens/${active.id}`)

      expect(await orderAndState()).toEqual([['Second', 1, 'upNext'], ['Third', 2, null]])
    })

    it('removes the Plugin Assignment of a deleted Plugin Screen, so the Plugin can be assigned again', async () => {
      const plugin = await seedPlugin('Weather')
      const assigned: ScreenRead = await (await http.postJson(`/api/plugins/${plugin.id}/assign`, { deviceId: device.id })).json()

      await deleteRequest(`/api/screens/${assigned.id}`)

      expect((await http.postJson(`/api/plugins/${plugin.id}/assign`, { deviceId: device.id })).status).toBe(201)
    })

    it('removes the stored image and its original', async () => {
      const kept: ScreenRead = await (await http.postJson('/api/screens', { deviceId: device.id, kind: 'external', name: 'Poster', url: 'https://example.com/poster.png', fetchManual: true })).json()

      await deleteRequest(`/api/screens/${kept.id}`)

      expect(await filesOfDevice()).toEqual([])
    })

    it.each([UNKNOWN_ID, 'not-an-id'])('answers 404 screen-not-found for %s', async (id) => {
      const response = await deleteRequest(`/api/screens/${id}`)

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ code: 'screen-not-found' })
    })
  })

  describe('unassigning a Plugin, DELETE /api/plugins/:id/assignments/:deviceId', () => {
    it('answers 204 and closes the gap in the Order', async () => {
      const plugin = await seedPlugin('Weather')
      await seedScreen(1, { filename: 'First', isActive: true })
      await http.postJson(`/api/plugins/${plugin.id}/assign`, { deviceId: device.id })
      await seedScreen(3, { filename: 'Last' })

      const response = await deleteRequest(`/api/plugins/${plugin.id}/assignments/${device.id}`)

      expect(response.status).toBe(204)
      expect(await orderAndState()).toEqual([['First', 1, 'active'], ['Last', 2, 'upNext']])
      expect(await database.getRepository(DevicePlugin).count()).toBe(0)
    })

    it.each([
      ['a Plugin that is not on the Device', () => seedPlugin('Weather').then(plugin => plugin.id), () => device.id],
      ['an unknown Plugin', async () => UNKNOWN_ID, () => device.id],
      ['an unknown Device', () => seedPlugin('Weather').then(plugin => plugin.id), () => 'not-an-id'],
    ])('answers 404 assignment-not-found for %s', async (_case, pluginId, deviceId) => {
      const response = await deleteRequest(`/api/plugins/${await pluginId()}/assignments/${deviceId()}`)

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ code: 'assignment-not-found' })
    })
  })

  describe('reordering, PUT /api/devices/:id/screens/order', () => {
    it('answers the Screens in the new Order and never moves the active flag', async () => {
      const first = await seedScreen(1, { filename: 'First' })
      const second = await seedScreen(2, { filename: 'Second', isActive: true })
      const third = await seedScreen(3, { filename: 'Third' })

      const response = await putOrder([third.id, first.id, second.id])

      expect(response.status).toBe(200)
      const answered: ScreenRead[] = await response.json()
      expect(answered.map(screen => [screen.name, screen.order, screen.state])).toEqual([['Third', 1, 'upNext'], ['First', 2, null], ['Second', 3, 'active']])
      expect(await readScreens()).toEqual(answered)
    })

    it.each([
      ['misses a Screen', (ids: string[]) => ids.slice(1)],
      ['repeats a Screen', (ids: string[]) => [ids[0], ids[0]]],
      ['names a Screen of another Device', (ids: string[]) => [ids[0], UNKNOWN_ID]],
      ['is empty', () => []],
    ])('answers 400 order-not-a-permutation for a list that %s', async (_case, listOf) => {
      const first = await seedScreen(1, { filename: 'First', isActive: true })
      const second = await seedScreen(2, { filename: 'Second' })

      const response = await putOrder(listOf([second.id, first.id]))

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ statusCode: 400, code: 'order-not-a-permutation' })
      expect(await orderAndState()).toEqual([['First', 1, 'active'], ['Second', 2, 'upNext']])
    })

    it('answers 404 device-not-found for an unknown Device', async () => {
      const response = await putOrder([UNKNOWN_ID], UNKNOWN_ID)

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ code: 'device-not-found' })
    })
  })

  it.each([
    ['GET', '/api/screens'],
    ['PATCH', `/api/screens/device/${UNKNOWN_ID}/reorder`],
    ['DELETE', `/api/mashup/${UNKNOWN_ID}`],
    ['DELETE', `/api/plugins/${UNKNOWN_ID}/unassign/${UNKNOWN_ID}`],
    ['PATCH', `/api/plugins/device-assignment/${UNKNOWN_ID}`],
    ['GET', `/api/plugins/device/${UNKNOWN_ID}`],
  ])('no longer routes %s %s', async (method, pathname) => {
    const response = await http.request(pathname, { method, headers: { 'content-type': 'application/json' }, body: method === 'GET' ? undefined : '{}' })

    expect(response.status).toBe(404)
  })
})
