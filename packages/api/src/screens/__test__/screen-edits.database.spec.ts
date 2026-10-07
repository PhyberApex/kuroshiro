import type { ScreenRead } from 'kuroshiro-shared'
import type { DataSource, DeepPartial } from 'typeorm'
import type { DeviceModelsService } from '../../device-models/device-models.service.js'
import type { HttpTestApp } from '../../test/httpApp.js'
import { Buffer } from 'node:buffer'
import * as fs from 'node:fs'
import path from 'node:path'
import { ConfigService } from '@nestjs/config'
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
import { Schedule } from '../../schedule/schedule.entity.js'
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

describe('editing a Screen, against a real database', () => {
  let database: DataSource
  let http: HttpTestApp
  let device: Device
  const config = { get: vi.fn() }

  beforeAll(async () => {
    database = await createTestDatabase()
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
          useValue: new PluginAssignmentsService(database.getRepository(Plugin), database.getRepository(Device), database.getRepository(DevicePlugin)),
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

  function patch(id: string, body: unknown): Promise<Response> {
    return http.request(`/api/screens/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  }

  function upload(method: string, pathname: string, file: Blob | null = new Blob([Buffer.from('replacement')])): Promise<Response> {
    const form = new FormData()
    if (file)
      form.set('file', file, 'new.jpg')
    return http.request(pathname, { method, body: form })
  }

  async function stored(id: string): Promise<Screen> {
    return database.getRepository(Screen).findOneByOrFail({ id })
  }

  async function seedFiles(screen: Screen): Promise<void> {
    await fs.promises.mkdir(deviceFolder(), { recursive: true })
    await fs.promises.writeFile(path.join(deviceFolder(), `${screen.id}.png`), 'old-png')
    await fs.promises.writeFile(path.join(deviceFolder(), `${screen.id}.original`), 'old-original')
  }

  async function fileContents(screen: Screen, extension: string): Promise<string> {
    return fs.promises.readFile(path.join(deviceFolder(), `${screen.id}.${extension}`), 'utf8')
  }

  describe('pATCH /api/screens/:id', () => {
    it('renames a Screen of every kind but a Plugin Screen, trimmed, and answers the whole ScreenRead', async () => {
      const html = await seedScreen(1, { filename: 'Old' })
      const plugin = await seedPlugin('Weather')
      const mashupScreen = await seedScreen(2, { type: 'mashup', filename: 'Board', html: null })
      await database.getRepository(MashupConfiguration).save({ layout: '1Lx1R', screen: mashupScreen })

      const renamed = await patch(html.id, { name: '  New  ' })
      const mashupRenamed = await patch(mashupScreen.id, { name: 'Dashboard' })

      expect(renamed.status).toBe(200)
      expect(await renamed.json()).toMatchObject({ id: html.id, kind: 'html', name: 'New', order: 1, html: '<p>Hi</p>' })
      expect(await mashupRenamed.json()).toMatchObject({ kind: 'mashup', name: 'Dashboard' })
      expect(plugin.name).toBe('Weather')
    })

    it('renames a File Screen without moving its render time or its upload time', async () => {
      const uploadedAt = new Date('2026-02-15T08:00:00.000Z')
      const screen = await seedScreen(1, { type: 'file', html: null, filename: 'Old', fileUploadedAt: uploadedAt })
      await seedFiles(screen)

      const response = await patch(screen.id, { name: 'New' })

      expect(await response.json()).toMatchObject({ name: 'New', renderedAt: CREATED_AT.toISOString(), file: { uploadedAt: uploadedAt.toISOString() } })
    })

    it('saves the markup of an HTML Screen', async () => {
      const screen = await seedScreen(1)

      const response = await patch(screen.id, { html: '<h1>Changed</h1>' })

      expect(await response.json()).toMatchObject({ html: '<h1>Changed</h1>', name: 'Screen 1' })
    })

    it('clears a remembered Render Signal when the HTML Screen\'s markup changes', async () => {
      const screen = await seedScreen(1, { renderSignal: 'skip' })

      await patch(screen.id, { html: '<h1>Changed</h1>' })

      expect((await stored(screen.id)).renderSignal).toBeNull()
    })

    it('saves the URL of an External link fetched on every poll without fetching it', async () => {
      const screen = await seedScreen(1, { type: 'external', html: null, externalLink: 'http://a.local/a.png' })

      const response = await patch(screen.id, { url: 'http://b.local/b.png' })

      expect(await response.json()).toMatchObject({ external: { url: 'http://b.local/b.png', fetchManual: false } })
      expect(downloadImage).not.toHaveBeenCalled()
    })

    it('fetches and converts a new URL of a kept External link before saving, replacing the image', async () => {
      const screen = await seedScreen(1, { type: 'external', html: null, externalLink: 'http://a.local/a.png', fetchManual: true })
      await seedFiles(screen)

      const response = await patch(screen.id, { url: 'http://b.local/b.png' })

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ external: { url: 'http://b.local/b.png', fetchManual: true } })
      expect(downloadImage).toHaveBeenCalledWith('http://b.local/b.png', expect.any(String), expect.anything())
      expect(await fileContents(screen, 'png')).toBe('image')
      expect(await filesOfDevice()).toHaveLength(2)
    })

    it('fetches when the choice switches to keeping the image and fetches nothing when it switches back', async () => {
      const screen = await seedScreen(1, { type: 'external', html: null, externalLink: 'http://a.local/a.png' })

      const kept = await patch(screen.id, { fetchManual: true })
      expect(await kept.json()).toMatchObject({ external: { url: 'http://a.local/a.png', fetchManual: true } })
      expect(downloadImage).toHaveBeenCalledTimes(1)

      const live = await patch(screen.id, { fetchManual: false })
      expect(await live.json()).toMatchObject({ external: { fetchManual: false } })
      expect(downloadImage).toHaveBeenCalledTimes(1)
    })

    it.each([
      ['the fetch', () => vi.mocked(downloadImage).mockRejectedValue(new Error('Failed to fetch image: Not Found')), 'Failed to fetch image: Not Found'],
      ['the conversion', () => vi.mocked(convertToPng).mockRejectedValue(new Error('Unsupported or unrecognised image format')), 'The address did not answer with an image Kuroshiro can read.'],
    ])('answers 422 image-fetch-failed with details.reason and keeps the earlier URL and image when %s fails', async (_step, fail, reason) => {
      const screen = await seedScreen(1, { type: 'external', html: null, externalLink: 'http://a.local/a.png', fetchManual: true })
      await seedFiles(screen)
      fail()

      const response = await patch(screen.id, { url: 'http://b.local/b.png' })

      expect(response.status).toBe(422)
      expect(await response.json()).toMatchObject({ statusCode: 422, code: 'image-fetch-failed', details: { reason } })
      expect((await stored(screen.id)).externalLink).toBe('http://a.local/a.png')
      expect(await fileContents(screen, 'png')).toBe('old-png')
      expect(await filesOfDevice()).toHaveLength(2)
    })

    it.each([
      ['name on a Plugin Screen', 'plugin', { name: 'X' }, 'name'],
      ['url on an HTML Screen', 'html', { url: 'http://a.local/' }, 'url'],
      ['fetchManual on a File Screen', 'file', { fetchManual: true }, 'fetchManual'],
      ['html on an External link', 'external', { html: '<p></p>' }, 'html'],
      ['html on a Mashup', 'mashup', { html: '<p></p>' }, 'html'],
    ] as const)('answers 400 screen-field-not-for-kind for %s and changes nothing', async (_case, type, body, field) => {
      const screen = await seedScreen(1, { type, html: type === 'html' ? '<p>Hi</p>' : null })

      const response = await patch(screen.id, body)

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'screen-field-not-for-kind', details: { fields: [field] } })
      expect((await stored(screen.id)).filename).toBe('Screen 1')
    })

    it.each([
      ['an empty name', { name: '  ' }, 'name'],
      ['a URL that is not http(s)', { url: 'ftp://a.local/a.png' }, 'url'],
      ['a fetch choice that is no boolean', { fetchManual: 'yes' }, 'fetchManual'],
      ['an unknown field', { order: 3 }, 'order'],
    ])('answers 400 with fields for %s', async (_case, body, field) => {
      const screen = await seedScreen(1, { type: 'external', html: null, externalLink: 'http://a.local/a.png' })

      const response = await patch(screen.id, body)

      expect(response.status).toBe(400)
      const answer = await response.json()
      expect(answer.code).toBe('validation')
      expect(answer.fields.map((entry: { path: string }) => entry.path)).toContain(field)
    })

    it('leaves the Order and the Active Screen as they were', async () => {
      await seedScreen(1, { filename: 'First', isActive: true })
      const second = await seedScreen(2, { filename: 'Second' })
      await seedScreen(3, { filename: 'Third' })

      await patch(second.id, { name: 'Renamed', html: '<p>Changed</p>' })

      expect(await orderAndState()).toEqual([['First', 1, 'active'], ['Renamed', 2, 'upNext'], ['Third', 3, null]])
      expect((await stored(second.id)).isActive).toBe(false)
    })

    it('answers 404 screen-not-found for an unknown Screen', async () => {
      const response = await patch(UNKNOWN_ID, { name: 'X' })

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ code: 'screen-not-found' })
    })
  })

  describe('pOST /api/screens/:id/image-preview', () => {
    it('answers the converted image as image/png and stores nothing', async () => {
      const screen = await seedScreen(1, { type: 'file', html: null })
      await seedFiles(screen)
      const before = await stored(screen.id)

      const response = await upload('POST', `/api/screens/${screen.id}/image-preview`)

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('image/png')
      expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('image')
      expect(await stored(screen.id)).toEqual(before)
      expect(await fileContents(screen, 'png')).toBe('old-png')
      expect(await filesOfDevice()).toHaveLength(2)
    })

    it('answers 400 image-unreadable for a file that cannot be converted', async () => {
      const screen = await seedScreen(1, { type: 'file', html: null })
      vi.mocked(readImageSize).mockRejectedValue(new Error('Unsupported or unrecognised image format'))

      const response = await upload('POST', `/api/screens/${screen.id}/image-preview`)

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'image-unreadable' })
      expect(await filesOfDevice()).toEqual([])
    })
  })

  describe('pUT /api/screens/:id/image', () => {
    it('swaps the image and the file facts, keeping id, name, Order and Schedule, with a new image version', async () => {
      const screen = await seedScreen(2, { type: 'file', html: null, filename: 'Holiday', fileOriginalName: 'old.jpg', fileWidth: 10, fileHeight: 10, fileBytes: 5, fileUploadedAt: new Date('2026-01-01T00:00:00.000Z') })
      await database.getRepository(Schedule).save({ screen, startTime: '08:00', endTime: '18:00' })
      await seedFiles(screen)
      const before: ScreenRead = (await (await http.request(`/api/devices/${device.id}/screens`)).json())[0]
      vi.mocked(readImageSize).mockResolvedValue({ width: 800, height: 480 })

      const response = await upload('PUT', `/api/screens/${screen.id}/image`)

      expect(response.status).toBe(200)
      const after: ScreenRead = await response.json()
      expect(after).toMatchObject({ id: screen.id, name: 'Holiday', order: 2, schedule: before.schedule, file: { originalName: 'new.jpg', width: 800, height: 480, bytes: 'replacement'.length } })
      expect(after.imagePath).not.toBe(before.imagePath)
      expect(after.file?.uploadedAt).not.toBe(before.file?.uploadedAt)
      expect(await fileContents(screen, 'png')).toBe('image')
      expect(await fileContents(screen, 'original')).toBe('replacement')
      expect(await filesOfDevice()).toHaveLength(2)
    })

    it('answers 400 image-unreadable and keeps the current image for a file that cannot be converted', async () => {
      const screen = await seedScreen(1, { type: 'file', html: null, fileOriginalName: 'old.jpg' })
      await seedFiles(screen)
      vi.mocked(convertToPng).mockRejectedValue(new Error('Unsupported or unrecognised image format'))

      const response = await upload('PUT', `/api/screens/${screen.id}/image`)

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'image-unreadable' })
      expect(await fileContents(screen, 'png')).toBe('old-png')
      expect((await stored(screen.id)).fileOriginalName).toBe('old.jpg')
      expect(await filesOfDevice()).toHaveLength(2)
    })

    it('answers 400 validation without a file', async () => {
      const screen = await seedScreen(1, { type: 'file', html: null })

      const response = await upload('PUT', `/api/screens/${screen.id}/image`, null)

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'validation', fields: [{ path: 'file' }] })
    })
  })

  describe.each([
    ['POST', 'image-preview'],
    ['PUT', 'image'],
  ])('%s /api/screens/:id/%s refusals', (method, suffix) => {
    it('answers 403 demo-mode', async () => {
      const screen = await seedScreen(1, { type: 'file', html: null })
      config.get.mockImplementation((key: string) => key === 'demo_mode')

      const response = await upload(method, `/api/screens/${screen.id}/${suffix}`)

      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({ code: 'demo-mode' })
    })

    it('answers 400 screen-field-not-for-kind for a Screen that is not a File Screen', async () => {
      const screen = await seedScreen(1)

      const response = await upload(method, `/api/screens/${screen.id}/${suffix}`)

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'screen-field-not-for-kind' })
    })

    it('answers 404 screen-not-found for an unknown Screen', async () => {
      const response = await upload(method, `/api/screens/${UNKNOWN_ID}/${suffix}`)

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ code: 'screen-not-found' })
    })
  })

  describe('pOST /api/screens/:id/refresh', () => {
    it('fetches a kept External link again and answers its ScreenRead', async () => {
      const screen = await seedScreen(1, { type: 'external', html: null, externalLink: 'http://a.local/a.png', fetchManual: true })
      await seedFiles(screen)

      const response = await http.request(`/api/screens/${screen.id}/refresh`, { method: 'POST' })

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ id: screen.id, external: { url: 'http://a.local/a.png', fetchManual: true } })
      expect(await fileContents(screen, 'png')).toBe('image')
    })

    it.each([
      ['the fetch', () => vi.mocked(downloadImage).mockRejectedValue(new Error('Failed to fetch image: Not Found')), 'Failed to fetch image: Not Found'],
      ['the conversion', () => vi.mocked(convertToPng).mockRejectedValue(new Error('Unsupported or unrecognised image format')), 'The address did not answer with an image Kuroshiro can read.'],
    ])('answers 422 image-fetch-failed with details.reason and keeps the earlier image when %s fails', async (_step, fail, reason) => {
      const screen = await seedScreen(1, { type: 'external', html: null, externalLink: 'http://a.local/a.png', fetchManual: true })
      await seedFiles(screen)
      fail()

      const response = await http.request(`/api/screens/${screen.id}/refresh`, { method: 'POST' })

      expect(response.status).toBe(422)
      expect(await response.json()).toMatchObject({ code: 'image-fetch-failed', details: { reason } })
      expect(await fileContents(screen, 'png')).toBe('old-png')
      expect(await fileContents(screen, 'original')).toBe('old-original')
    })

    it('answers 400 for a Screen that fetches on every poll', async () => {
      const screen = await seedScreen(1, { type: 'external', html: null, externalLink: 'http://a.local/a.png' })

      const response = await http.request(`/api/screens/${screen.id}/refresh`, { method: 'POST' })

      expect(response.status).toBe(400)
    })

    it('leaves no route at the bare POST /api/screens/:id', async () => {
      const screen = await seedScreen(1, { type: 'external', html: null, externalLink: 'http://a.local/a.png', fetchManual: true })

      expect((await http.request(`/api/screens/${screen.id}`, { method: 'POST' })).status).toBe(404)
    })
  })

  describe('pATCH /api/mashup/:id', () => {
    async function seedMashup(layout: string, plugins: Plugin[]): Promise<Screen> {
      const screen = await seedScreen(1, { type: 'mashup', html: null, filename: 'Board', cachedPluginOutput: '<p>cached</p>', renderSignal: 'skip' })
      const configuration = await database.getRepository(MashupConfiguration).save({ layout, screen })
      const slots = layout === '1Lx1R'
        ? [['left', 'view--half_vertical'], ['right', 'view--half_vertical']]
        : [['top-left', 'view--quadrant'], ['top-right', 'view--quadrant'], ['bottom-left', 'view--quadrant'], ['bottom-right', 'view--quadrant']]
      await database.getRepository(MashupSlot).save(slots.map(([position, size], index) => ({ position, size, order: index, plugin: plugins[index], mashupConfiguration: configuration })))
      return screen
    }

    async function seedPlugins(count: number): Promise<Plugin[]> {
      return Promise.all(Array.from({ length: count }, (_, index) => seedPlugin(`Plugin ${index + 1}`)))
    }

    function patchMashup(id: string, body: unknown): Promise<Response> {
      return http.request(`/api/mashup/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    }

    it('swaps a slot under the same layout and clears the cached output', async () => {
      const plugins = await seedPlugins(3)
      const screen = await seedMashup('1Lx1R', plugins)

      const response = await patchMashup(screen.id, { pluginIds: [plugins[0].id, plugins[2].id] })

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ id: screen.id, name: 'Board', mashup: { layout: '1Lx1R', slots: [{ pluginName: 'Plugin 1' }, { pluginName: 'Plugin 3' }] } })
      expect((await stored(screen.id)).cachedPluginOutput).toBeNull()
      expect((await stored(screen.id)).renderSignal).toBeNull()
    })

    it('changes the layout together with a full slot list', async () => {
      const plugins = await seedPlugins(4)
      const screen = await seedMashup('1Lx1R', plugins)

      const response = await patchMashup(screen.id, { layout: '2x2', pluginIds: plugins.map(plugin => plugin.id) })

      const read: ScreenRead = await response.json()
      expect(read.mashup?.layout).toBe('2x2')
      expect(read.mashup?.slots.map(slot => slot.pluginName)).toEqual(['Plugin 1', 'Plugin 2', 'Plugin 3', 'Plugin 4'])
    })

    it.each([
      ['too few Plugins for the new layout', (plugins: Plugin[]) => ({ layout: '2x2', pluginIds: [plugins[0].id, plugins[1].id] })],
      ['too many Plugins for the current layout', (plugins: Plugin[]) => ({ pluginIds: plugins.map(plugin => plugin.id) })],
      ['a repeated Plugin', (plugins: Plugin[]) => ({ pluginIds: [plugins[0].id, plugins[0].id] })],
    ])('answers 400 at pluginIds for %s and saves nothing', async (_case, body) => {
      const plugins = await seedPlugins(4)
      const screen = await seedMashup('1Lx1R', plugins)

      const response = await patchMashup(screen.id, body(plugins))

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'validation', fields: [{ path: 'pluginIds' }] })
      const read: ScreenRead = await (await http.request(`/api/devices/${device.id}/screens`)).json().then((screens: ScreenRead[]) => screens[0])
      expect(read.mashup).toMatchObject({ layout: '1Lx1R', slots: [{ pluginName: 'Plugin 1' }, { pluginName: 'Plugin 2' }] })
      expect((await stored(screen.id)).cachedPluginOutput).toBe('<p>cached</p>')
    })

    it('answers 404 plugin-not-found for an unknown Plugin and keeps the slots', async () => {
      const plugins = await seedPlugins(2)
      const screen = await seedMashup('1Lx1R', plugins)

      const response = await patchMashup(screen.id, { pluginIds: [plugins[0].id, UNKNOWN_ID] })

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ code: 'plugin-not-found' })
      expect(await database.getRepository(MashupSlot).count()).toBe(2)
    })

    it('answers 400 for the old filename key and 404 for a Screen that is no Mashup', async () => {
      const plugins = await seedPlugins(2)
      const screen = await seedMashup('1Lx1R', plugins)
      const other = await seedScreen(2)
      const ids = plugins.map(plugin => plugin.id)

      expect((await patchMashup(screen.id, { filename: 'X', pluginIds: ids })).status).toBe(400)
      expect((await patchMashup(other.id, { pluginIds: ids })).status).toBe(404)
      expect((await patchMashup(UNKNOWN_ID, { pluginIds: ids })).status).toBe(404)
    })

    it.each([
      ['PUT /api/mashup/:id', 'PUT', `/api/mashup/${UNKNOWN_ID}`],
      ['GET /api/mashup/:id/configuration', 'GET', `/api/mashup/${UNKNOWN_ID}/configuration`],
      ['GET /api/mashup/layouts', 'GET', '/api/mashup/layouts'],
    ])('has no route %s', async (_name, method, pathname) => {
      expect((await http.request(pathname, { method })).status).toBe(404)
    })
  })
})
