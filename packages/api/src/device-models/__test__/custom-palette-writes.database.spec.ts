import type { ConfigService } from '@nestjs/config'
import type { PaletteRead, ScreenRead } from 'kuroshiro-shared'
import type { DataSource } from 'typeorm'
import type { HttpTestApp } from '../../test/httpApp.js'
import * as fs from 'node:fs'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Alert } from '../../alerts/entities/alert.entity.js'
import { Device } from '../../devices/devices.entity.js'
import { PluginFieldValue } from '../../plugins/entities/plugin-field-value.entity.js'
import { PluginField } from '../../plugins/entities/plugin-field.entity.js'
import { PluginFieldValuesService } from '../../plugins/services/plugin-field-values.service.js'
import { DeviceScreensController } from '../../screens/device-screens.controller.js'
import { ScreenReadsService } from '../../screens/screen-reads.service.js'
import { Screen } from '../../screens/screens.entity.js'
import { ScreensService } from '../../screens/screens.service.js'
import { SyncRun } from '../../sync-runs/entities/sync-run.entity.js'
import { SyncRunService } from '../../sync-runs/sync-run.service.js'
import { createHttpTestApp } from '../../test/httpApp.js'
import { asService } from '../../test/mockService.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { convertToPng } from '../../utils/imageUtils.js'
import { resolveAppPath } from '../../utils/pathHelper.js'
import { CustomPalettesController } from '../custom-palettes.controller.js'
import { CustomPalettesService } from '../custom-palettes.service.js'
import { DeviceModelReadsService } from '../device-model-reads.service.js'
import { DeviceModelsService } from '../device-models.service.js'
import { DeviceModel } from '../entities/device-model.entity.js'
import { Palette } from '../entities/palette.entity.js'

vi.mock('../../utils/imageUtils.js', () => ({
  downloadImage: vi.fn(),
  convertToPng: vi.fn(),
  readImageSize: vi.fn(),
}))

const RED_FAMILY = 'screen--color-3bwr'
const SIX_COLOURS = 'screen--color-6a'
const MODEL_BASE = { width: 800, height: 480, colors: 4, bitDepth: 2, scaleFactor: 1, kind: 'trmnl' }
const SOFT_RED = { name: 'Soft red', frameworkClass: RED_FAMILY, colors: ['#111111', '#B53A30', '#F2F0EA'] }

async function writeStandInFile(destination: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(destination), { recursive: true })
  await fs.promises.writeFile(destination, 'image')
}

describe('creating, changing and deleting a custom Palette, against a real database', () => {
  let database: DataSource
  let http: HttpTestApp
  let customPalettes: CustomPalettesService
  const devicesWithImages: string[] = []

  beforeAll(async () => {
    database = await createTestDatabase()
    // `synchronize` cannot express a partial, case-insensitive index from a plain entity decorator; this mirrors what the migration adds in production.
    await database.query(`CREATE UNIQUE INDEX "UQ_palette_name_custom" ON "palette" (lower("name")) WHERE "kind" = 'custom'`)
    const deviceModels = new DeviceModelsService(database.getRepository(DeviceModel), database.getRepository(Palette))
    const reads = new DeviceModelReadsService(database.getRepository(Device), deviceModels, new SyncRunService(database.getRepository(SyncRun)))
    const screens = new ScreensService(database.getRepository(Screen), database.getRepository(Device), asService<ConfigService>({ get: () => false }), deviceModels)
    customPalettes = new CustomPalettesService(database.getRepository(Palette), database.getRepository(Device), deviceModels, screens)
    const fieldValues = new PluginFieldValuesService(database.getRepository(PluginFieldValue), database.getRepository(PluginField))
    const screenReads = new ScreenReadsService(database.getRepository(Screen), database.getRepository(Device), database.getRepository(Alert), fieldValues)

    http = await createHttpTestApp({
      controllers: [CustomPalettesController, DeviceScreensController],
      providers: [
        { provide: CustomPalettesService, useValue: customPalettes },
        { provide: DeviceModelReadsService, useValue: reads },
        { provide: ScreenReadsService, useValue: screenReads },
        { provide: ScreensService, useValue: screens },
      ],
    })
  })

  beforeEach(async () => {
    vi.mocked(convertToPng).mockReset().mockImplementation(async (_input, output) => writeStandInFile(output))
    await database.query(`TRUNCATE "device", "device_model", "palette" CASCADE`)
    await database.getRepository(Palette).save([
      { id: 'bw', name: 'Black & White', kind: 'official', grays: 2, frameworkClass: 'screen--1bit' },
      { id: 'red', name: 'Color (3 colors)', kind: 'official', grays: 2, colors: ['#000000', '#FF0000', '#FFFFFF'], frameworkClass: RED_FAMILY },
      { id: 'six', name: 'Color (6 colors)', kind: 'official', grays: 2, colors: ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00'], frameworkClass: SIX_COLOURS },
      { id: 'study-panel', name: 'Study panel', kind: 'custom', grays: 2, colors: ['#16141C', '#E6E6E0', '#9E2A22'], frameworkClass: RED_FAMILY },
    ])
    await database.getRepository(DeviceModel).save([
      { ...MODEL_BASE, name: 'og_bwr', label: 'OG red', paletteIds: ['bw', 'red'] },
      { ...MODEL_BASE, name: 'seeed', label: 'Seeed', paletteIds: ['bw', 'six'] },
    ])
  })

  afterEach(async () => {
    await Promise.all(devicesWithImages.splice(0).map(id => fs.promises.rm(resolveAppPath('public', 'screens', 'devices', id), { recursive: true, force: true })))
  })

  afterAll(async () => {
    await http.app.close()
    await database.destroy()
  })

  /** A Device on the red Device Model set to the custom Palette, with one File Screen whose image is stored. */
  async function studyOnTheCustomPalette(): Promise<{ device: Device, screen: Screen }> {
    const device = await database.getRepository(Device).save({
      name: 'Study',
      friendlyId: 'STUDY1',
      mac: 'AA:BB:CC:DD:EE:01',
      apikey: 'key',
      deviceModel: { name: 'og_bwr' },
      palette: { id: 'study-panel' },
    } as Device)
    const screen = await database.getRepository(Screen).save({ type: 'file', filename: 'Photo', order: 1, isActive: true, fetchManual: false, generatedAt: new Date('2026-10-01T09:30:00.000Z'), fileUploadedAt: new Date('2026-09-15T08:00:00.000Z'), device })
    devicesWithImages.push(device.id)
    await writeStandInFile(resolveAppPath('public', 'screens', 'devices', device.id, `${screen.id}.png`))
    return { device, screen }
  }

  function send(method: string, route: string, body?: unknown): Promise<Response> {
    return http.request(route, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  }

  async function readScreens(deviceId: string): Promise<ScreenRead[]> {
    const response = await http.request(`/api/devices/${deviceId}/screens`)
    expect(response.status).toBe(200)
    return response.json()
  }

  const paletteOf = async (deviceId: string) => (await database.getRepository(Device).findOneByOrFail({ id: deviceId })).palette

  /** The Palette each conversion of a stored image was asked for, by the Screen's file. */
  const conversions = () => vi.mocked(convertToPng).mock.calls.map(([source, , target]) => ({ file: path.basename(source), colors: target.palette.colors, palette: target.palette.id }))

  describe('pOST /api/device-models/palettes', () => {
    it('answers 201 with the new Palette as a read, used by no Device', async () => {
      const response = await send('POST', '/api/device-models/palettes', SOFT_RED)
      const created: PaletteRead = await response.json()

      expect(response.status).toBe(201)
      expect(created).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        name: 'Soft red',
        kind: 'custom',
        grays: 2,
        colors: ['#111111', '#B53A30', '#F2F0EA'],
        frameworkClass: RED_FAMILY,
        grayscaleBitDepth: null,
        deprecated: false,
        syncedAt: null,
        usedBy: [],
      })
    })

    it('refuses a name a custom Palette already has, in another letter case, with palette-name-taken', async () => {
      const response = await send('POST', '/api/device-models/palettes', { ...SOFT_RED, name: '  STUDY PANEL ' })

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ code: 'palette-name-taken' })
      expect(await database.getRepository(Palette).countBy({ kind: 'custom' })).toBe(1)
    })

    it('refuses with palette-name-taken when another create wins a race the up-front check missed', async () => {
      const assertNameFree = vi.spyOn(customPalettes as unknown as { assertNameFree: (name: string) => Promise<void> }, 'assertNameFree')
      assertNameFree.mockImplementationOnce(async () => {
        // The other request's write, landing between this one's check and its own write.
        await database.getRepository(Palette).save({ id: 'other-soft-red', name: 'soft RED', kind: 'custom', grays: 2, colors: SOFT_RED.colors, frameworkClass: RED_FAMILY })
      })

      const response = await send('POST', '/api/device-models/palettes', SOFT_RED)

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ code: 'palette-name-taken' })
      expect(await database.getRepository(Palette).countBy({ kind: 'custom' })).toBe(2)
      assertNameFree.mockRestore()
    })

    it('takes the name of one of TRMNL\'s Palettes, which is not a custom one', async () => {
      const response = await send('POST', '/api/device-models/palettes', { ...SOFT_RED, name: 'color (3 colors)' })

      expect(response.status).toBe(201)
    })

    it.each([
      ['an empty name', { name: '  ' }, 'name'],
      ['no colour', { colors: [] }, 'colors'],
      ['a colour that is not #RRGGBB', { colors: ['#B53A3'] }, 'colors'],
      ['a family no custom Palette can be in', { frameworkClass: 'screen--1bit' }, 'frameworkClass'],
    ])('refuses %s as a validation failure', async (_, change, field) => {
      const response = await send('POST', '/api/device-models/palettes', { ...SOFT_RED, ...change })

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'validation', fields: [expect.objectContaining({ path: field })] })
    })

    it('takes a single colour and many: no rule on the number beyond one', async () => {
      expect((await send('POST', '/api/device-models/palettes', { ...SOFT_RED, name: 'One', colors: ['#000000'] })).status).toBe(201)
      expect((await send('POST', '/api/device-models/palettes', { ...SOFT_RED, name: 'Many', colors: Array.from({ length: 12 }).fill('#123456') })).status).toBe(201)
    })
  })

  describe('pATCH /api/device-models/palettes/:id', () => {
    it('changes the colours, answers the Palette with its Devices, and converts their stored File Screen image again with the new colours', async () => {
      const { device, screen } = await studyOnTheCustomPalette()

      const response = await send('PATCH', '/api/device-models/palettes/study-panel', { colors: ['#000000', '#FFFFFF', '#C0392B', '#D8C13A'] })
      const changed: PaletteRead = await response.json()

      expect(response.status).toBe(200)
      expect(changed).toMatchObject({ id: 'study-panel', name: 'Study panel', colors: ['#000000', '#FFFFFF', '#C0392B', '#D8C13A'], usedBy: [{ id: device.id, name: 'Study' }] })
      expect(conversions()).toEqual([{ file: `${screen.id}.png`, palette: 'study-panel', colors: ['#000000', '#FFFFFF', '#C0392B', '#D8C13A'] }])
    })

    it('keeps a File Screen\'s file.uploadedAt through the re-conversion a Palette colour change causes, while renderedAt moves', async () => {
      const { device } = await studyOnTheCustomPalette()
      const [before] = await readScreens(device.id)

      const response = await send('PATCH', '/api/device-models/palettes/study-panel', { colors: ['#000000', '#FFFFFF', '#C0392B', '#D8C13A'] })
      expect(response.status).toBe(200)

      const [after] = await readScreens(device.id)
      expect(before.file?.uploadedAt).toBe('2026-09-15T08:00:00.000Z')
      expect(after.file?.uploadedAt).toBe(before.file?.uploadedAt)
      expect(after.renderedAt).not.toBe(before.renderedAt)
    })

    it('renames a Palette, and keeps its own name in another letter case', async () => {
      expect((await (await send('PATCH', '/api/device-models/palettes/study-panel', { name: 'Study panel, measured' })).json()).name).toBe('Study panel, measured')
      expect((await send('PATCH', '/api/device-models/palettes/study-panel', { name: 'STUDY PANEL, MEASURED' })).status).toBe(200)
    })

    it('refuses a name another custom Palette has, in another letter case, with palette-name-taken', async () => {
      await send('POST', '/api/device-models/palettes', SOFT_RED)

      const response = await send('PATCH', '/api/device-models/palettes/study-panel', { name: 'soft RED' })

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ code: 'palette-name-taken' })
    })

    it('changes the Palette Family of a Palette no Device uses', async () => {
      const response = await send('PATCH', '/api/device-models/palettes/study-panel', { frameworkClass: SIX_COLOURS })

      expect(response.status).toBe(200)
      expect((await response.json()).frameworkClass).toBe(SIX_COLOURS)
    })

    it('refuses a Palette Family change while a Device uses it with palette-in-use, and changes nothing', async () => {
      const { device } = await studyOnTheCustomPalette()

      const response = await send('PATCH', '/api/device-models/palettes/study-panel', { frameworkClass: SIX_COLOURS, colors: ['#000000'] })

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ code: 'palette-in-use', details: { usedBy: [{ id: device.id, name: 'Study' }] } })
      expect(await database.getRepository(Palette).findOneByOrFail({ id: 'study-panel' })).toMatchObject({ frameworkClass: RED_FAMILY, colors: ['#16141C', '#E6E6E0', '#9E2A22'] })
      expect(convertToPng).not.toHaveBeenCalled()
    })

    it('takes the Palette Family it already has while a Device uses it', async () => {
      await studyOnTheCustomPalette()

      expect((await send('PATCH', '/api/device-models/palettes/study-panel', { frameworkClass: RED_FAMILY, name: 'Study' })).status).toBe(200)
    })

    it('refuses one of TRMNL\'s Palettes with palette-not-custom', async () => {
      const response = await send('PATCH', '/api/device-models/palettes/red', { name: 'Mine' })

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'palette-not-custom' })
    })

    it('answers 404 for a Palette that does not exist', async () => {
      expect((await send('PATCH', '/api/device-models/palettes/gone', { name: 'Mine' })).status).toBe(404)
    })

    it('refuses an empty colour list and a key it does not know', async () => {
      expect((await send('PATCH', '/api/device-models/palettes/study-panel', { colors: [] })).status).toBe(400)
      expect((await send('PATCH', '/api/device-models/palettes/study-panel', { kind: 'official' })).status).toBe(400)
    })
  })

  describe('dELETE /api/device-models/palettes/:id', () => {
    it('answers 204, gives each Device its Device Model\'s richest Palette, and converts its stored images again for that one', async () => {
      const { device, screen } = await studyOnTheCustomPalette()

      const response = await send('DELETE', '/api/device-models/palettes/study-panel')

      expect(response.status).toBe(204)
      expect(await database.getRepository(Palette).findOneBy({ id: 'study-panel' })).toBeNull()
      expect((await paletteOf(device.id))?.id).toBe('red')
      expect(conversions()).toEqual([{ file: `${screen.id}.png`, palette: 'red', colors: ['#000000', '#FF0000', '#FFFFFF'] }])
    })

    it('converts nothing when no Device uses it', async () => {
      expect((await send('DELETE', '/api/device-models/palettes/study-panel')).status).toBe(204)
      expect(convertToPng).not.toHaveBeenCalled()
    })

    it('refuses one of TRMNL\'s Palettes with palette-not-custom', async () => {
      const response = await send('DELETE', '/api/device-models/palettes/red')

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'palette-not-custom' })
    })
  })
})
