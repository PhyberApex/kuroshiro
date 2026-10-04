import type { ConfigService } from '@nestjs/config'
import type { CleanupResult, StorageCheck, StorageFinding } from 'kuroshiro-shared'
import type { DataSource, DeepPartial } from 'typeorm'
import type { DeviceModelsService } from '../../device-models/device-models.service.js'
import type { HttpTestApp } from '../../test/httpApp.js'
import * as fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Device } from '../../devices/devices.entity.js'
import { Screen } from '../../screens/screens.entity.js'
import { ScreensService } from '../../screens/screens.service.js'
import { createHttpTestApp } from '../../test/httpApp.js'
import { asService } from '../../test/mockService.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { resolveAppPath } from '../../utils/pathHelper.js'
import { MaintenanceController } from '../maintenance.controller.js'
import { MaintenanceService } from '../maintenance.service.js'
import { RetentionService } from '../retention.service.js'

vi.mock('../../utils/pathHelper.js', async () => {
  const os = await import('node:os')
  const { join } = await import('node:path')
  const root = join(os.tmpdir(), `kuroshiro-storage-check-${process.pid}`)
  return { resolveAppPath: (...segments: string[]) => join(root, ...segments) }
})

const GONE_DEVICE_ID = '99999999-9999-4999-8999-999999999999'
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000

describe('the stored-files check and its cleanup, against a real database and real files', () => {
  let database: DataSource
  let http: HttpTestApp
  let device: Device

  beforeAll(async () => {
    database = await createTestDatabase()
    const screens = new ScreensService(
      database.getRepository(Screen),
      database.getRepository(Device),
      asService<ConfigService>({ get: vi.fn() }),
      asService<DeviceModelsService>({}),
    )
    http = await createHttpTestApp({
      controllers: [MaintenanceController],
      providers: [
        { provide: MaintenanceService, useValue: new MaintenanceService(database.getRepository(Device), database.getRepository(Screen), screens) },
        { provide: RetentionService, useValue: {} },
      ],
    })
  })

  beforeEach(async () => {
    await fs.promises.rm(resolveAppPath(), { recursive: true, force: true })
    await database.getRepository(Device).createQueryBuilder().delete().execute()
    device = await database.getRepository(Device).save({ name: 'Kitchen', friendlyId: 'ABC123', mac: 'AA:BB:CC:DD:EE:01', apikey: 'device-secret', refreshRate: 300 })
  })

  afterAll(async () => {
    await fs.promises.rm(resolveAppPath(), { recursive: true, force: true })
    await http.app.close()
    await database.destroy()
  })

  async function store(segments: string[], { bytes = 10, old = false } = {}): Promise<string> {
    const file = resolveAppPath(...segments)
    await fs.promises.mkdir(path.dirname(file), { recursive: true })
    await fs.promises.writeFile(file, 'x'.repeat(bytes))
    if (old) {
      const then = new Date(Date.now() - TWO_DAYS_MS)
      await fs.promises.utimes(file, then, then)
    }
    return file
  }

  const inDeviceFolder = (deviceId: string, file: string) => ['public', 'screens', 'devices', deviceId, file]

  async function seedScreen(order: number, overrides: DeepPartial<Screen> = {}): Promise<Screen> {
    return database.getRepository(Screen).save({ type: 'file', filename: `Screen ${order}`, order, isActive: false, fetchManual: false, generatedAt: new Date(), device, ...overrides })
  }

  async function seedScreenWithImage(order: number, overrides: DeepPartial<Screen> = {}): Promise<Screen> {
    const screen = await seedScreen(order, overrides)
    await store(inDeviceFolder(device.id, `${screen.id}.png`))
    return screen
  }

  async function check(): Promise<StorageCheck> {
    const response = await http.request('/api/maintenance/scan')
    expect(response.status).toBe(200)
    return response.json()
  }

  async function cleanUp(findingIds: string[]): Promise<CleanupResult> {
    const response = await http.postJson('/api/maintenance/cleanup', { findingIds })
    expect(response.status).toBe(201)
    return response.json()
  }

  const exists = (file: string) => fs.promises.access(file).then(() => true, () => false)

  const byGroup = (findings: StorageFinding[], group: StorageFinding['group']) => findings.filter(finding => finding.group === group)

  async function storeOneOfEveryFileGroup() {
    return {
      used: await seedScreenWithImage(1),
      unusedImage: await store(inDeviceFolder(device.id, 'deleted-screen.png'), { bytes: 40 }),
      tempFile: await store(inDeviceFolder(device.id, 'tmp-source'), { bytes: 30, old: true }),
      folderFile: await store(inDeviceFolder(GONE_DEVICE_ID, 'left.png'), { bytes: 20 }),
      oldUpload: await store(['uploads', 'abc123'], { bytes: 50, old: true }),
    }
  }

  describe('gET /api/maintenance/scan', () => {
    it('answers the Screen image totals and nothing to clean up for storage every file of which is used', async () => {
      await seedScreenWithImage(1)

      const answer = await check()

      expect(answer.screenImages).toEqual({ files: 1, bytes: 10 })
      expect(answer.findings).toEqual([])
      expect(new Date(answer.checkedAt).toISOString()).toBe(answer.checkedAt)
    })

    it('answers nothing to clean up before anything was ever stored', async () => {
      expect(await check()).toMatchObject({ screenImages: { files: 0, bytes: 0 }, findings: [] })
    })

    it('answers one finding per leftover, by group, with a path below the storage folder and its size', async () => {
      await storeOneOfEveryFileGroup()

      const { findings } = await check()

      expect(findings.map(({ id: _id, ...finding }) => finding)).toEqual([
        { group: 'unusedImage', path: `devices/${device.id}/deleted-screen.png`, bytes: 40 },
        { group: 'deletedDeviceFolder', path: `devices/${GONE_DEVICE_ID}`, bytes: 20, files: 1 },
        { group: 'tempFile', path: `devices/${device.id}/tmp-source`, bytes: 30 },
        { group: 'oldUpload', path: 'uploads/abc123', bytes: 50 },
      ])
    })

    it('counts in the Screen image totals only what no finding names, in the folders of registered Devices', async () => {
      await storeOneOfEveryFileGroup()

      expect((await check()).screenImages).toEqual({ files: 1, bytes: 10 })
    })

    it('passes over a file that goes while it is being checked', async () => {
      await seedScreenWithImage(1)
      const vanishing = await store(inDeviceFolder(device.id, 'tmp-vanishing'))
      const stat = fs.promises.stat
      const statSpy = vi.spyOn(fs.promises, 'stat').mockImplementation(async (file, ...rest) => {
        if (String(file) === vanishing)
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
        return stat(file, ...rest)
      })

      const answer = await check()
      statSpy.mockRestore()

      expect(answer).toMatchObject({ screenImages: { files: 1, bytes: 10 }, findings: [] })
    })

    it('answers no absolute path', async () => {
      await storeOneOfEveryFileGroup()
      await seedScreen(2)

      const answer = await check()

      expect(JSON.stringify(answer)).not.toContain(resolveAppPath())
      expect(answer.findings.flatMap(finding => 'path' in finding ? [finding.path] : []).filter(path.isAbsolute)).toEqual([])
    })

    it('gives a finding the same id in two scans of unchanged storage', async () => {
      await storeOneOfEveryFileGroup()
      await seedScreen(2)

      const first = await check()
      const second = await check()

      expect(first.findings).toHaveLength(5)
      expect(new Set(first.findings.map(finding => finding.id)).size).toBe(5)
      expect(second.findings.map(finding => finding.id)).toEqual(first.findings.map(finding => finding.id))
    })

    it('leaves a temporary file and an upload of today alone', async () => {
      await store(inDeviceFolder(device.id, 'tmp-source'))
      await store(['uploads', 'fresh'])

      expect((await check()).findings).toEqual([])
    })

    it('never lists a mirrored image, a file of the system or a file in a folder of its own as an image no Screen uses', async () => {
      await store(inDeviceFolder(device.id, 'mirror.png'))
      await store(inDeviceFolder(device.id, 'error.png'))
      await store(inDeviceFolder(device.id, 'notes.txt'))
      await store(inDeviceFolder(device.id, 'nested/left.png'))

      const answer = await check()

      expect(answer.findings).toEqual([])
      expect(answer.screenImages).toEqual({ files: 4, bytes: 40 })
    })

    it('lists a File Screen whose image is gone with its name, kind, Device and Order', async () => {
      await seedScreenWithImage(1)
      const broken = await seedScreen(2, { filename: 'Holiday photo' })

      const { findings } = await check()

      expect(findings).toEqual([{
        id: expect.any(String),
        group: 'missingImage',
        screen: { id: broken.id, name: 'Holiday photo', kind: 'file', deviceId: device.id, deviceName: 'Kitchen', order: 2 },
      }])
    })

    it('never lists an HTML Screen that was not polled yet, a Plugin Screen, a Mashup or an External link', async () => {
      await seedScreen(1, { type: 'html', html: '<p>Hi</p>' })
      await seedScreen(2, { type: 'plugin' })
      await seedScreen(3, { type: 'mashup' })
      await seedScreen(4, { type: 'external', externalLink: 'https://example.com/a.png' })

      expect(byGroup((await check()).findings, 'missingImage')).toEqual([])
    })
  })

  describe('pOST /api/maintenance/cleanup', () => {
    it('removes the findings it is sent and answers what went', async () => {
      const stored = await storeOneOfEveryFileGroup()
      const { findings } = await check()

      const answer = await cleanUp(findings.map(finding => finding.id))

      expect(answer).toEqual({ removed: { files: 3, folders: 1, screens: 0, bytes: 140 }, failed: [] })
      expect(await Promise.all([stored.unusedImage, stored.tempFile, stored.folderFile, stored.oldUpload].map(exists))).toEqual([false, false, false, false])
      expect(await exists(resolveAppPath(...inDeviceFolder(device.id, `${stored.used.id}.png`)))).toBe(true)
      expect((await check()).findings).toEqual([])
    })

    it('leaves a finding it was not sent', async () => {
      const stored = await storeOneOfEveryFileGroup()
      const { findings } = await check()

      const answer = await cleanUp(byGroup(findings, 'oldUpload').map(finding => finding.id))

      expect(answer.removed).toEqual({ files: 1, folders: 0, screens: 0, bytes: 50 })
      expect(await Promise.all([stored.unusedImage, stored.tempFile, stored.folderFile].map(exists))).toEqual([true, true, true])
    })

    it('deletes nothing for a path-shaped or unknown id and reports each as no longer found', async () => {
      const stored = await storeOneOfEveryFileGroup()
      const used = resolveAppPath(...inDeviceFolder(device.id, `${stored.used.id}.png`))
      const sent = [used, stored.unusedImage, `devices/${device.id}/deleted-screen.png`, `unusedImage:../../../${stored.used.id}.png`, 'missingImage:nothing']

      const answer = await cleanUp(sent)

      expect(answer.removed).toEqual({ files: 0, folders: 0, screens: 0, bytes: 0 })
      expect(answer.failed).toEqual(sent.map(findingId => ({ findingId, reason: 'No longer found.' })))
      expect(await Promise.all([used, stored.unusedImage].map(exists))).toEqual([true, true])
    })

    it('reports a finding that went since the scan as no longer found', async () => {
      const stored = await storeOneOfEveryFileGroup()
      const [upload] = byGroup((await check()).findings, 'oldUpload')
      await fs.promises.rm(stored.oldUpload)

      const answer = await cleanUp([upload!.id])

      expect(answer).toEqual({ removed: { files: 0, folders: 0, screens: 0, bytes: 0 }, failed: [{ findingId: upload!.id, reason: 'No longer found.' }] })
    })

    it('keeps cleaning up after a finding the server cannot delete and reports it without its absolute path', async () => {
      const stored = await storeOneOfEveryFileGroup()
      const { findings } = await check()
      const [unused] = byGroup(findings, 'unusedImage')
      const unlink = vi.spyOn(fs.promises, 'unlink').mockImplementationOnce(async () => {
        throw Object.assign(new Error(`EACCES: permission denied, unlink '${stored.unusedImage}'`), { code: 'EACCES' })
      })

      const answer = await cleanUp(findings.map(finding => finding.id))
      unlink.mockRestore()

      expect(answer).toEqual({
        removed: { files: 2, folders: 1, screens: 0, bytes: 100 },
        failed: [{ findingId: unused!.id, reason: 'The server could not delete it (EACCES).' }],
      })
      expect((await check()).findings).toEqual([unused])
    })

    it('removes a Screen whose image is missing and closes the gap it leaves in the Order', async () => {
      await seedScreenWithImage(1, { filename: 'First' })
      const broken = await seedScreen(2, { filename: 'Holiday photo' })
      await store(inDeviceFolder(device.id, `${broken.id}.original`))
      await seedScreenWithImage(3, { filename: 'Last' })
      const [finding] = byGroup((await check()).findings, 'missingImage')

      const answer = await cleanUp([finding!.id])

      expect(answer).toEqual({ removed: { files: 0, folders: 0, screens: 1, bytes: 0 }, failed: [] })
      const remaining = await database.getRepository(Screen).find({ where: { device: { id: device.id } }, order: { order: 'ASC' } })
      expect(remaining.map(screen => [screen.filename, screen.order])).toEqual([['First', 1], ['Last', 2]])
      expect(await exists(resolveAppPath(...inDeviceFolder(device.id, `${broken.id}.original`)))).toBe(false)
    })

    it.each([
      ['dryRun', { findingIds: [], dryRun: true }],
      ['paths', { findingIds: [], orphanedFiles: ['/etc/passwd'] }],
      ['no ids', {}],
      ['ids that are not strings', { findingIds: [1] }],
    ])('refuses a request with %s', async (_what, body) => {
      const response = await http.postJson('/api/maintenance/cleanup', body)

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'validation' })
    })
  })

  it('answers 404 for GET /api/maintenance/stats', async () => {
    const response = await http.request('/api/maintenance/stats')

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ code: 'not-found' })
  })
})
