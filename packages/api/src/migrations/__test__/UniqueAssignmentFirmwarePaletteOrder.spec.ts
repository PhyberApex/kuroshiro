import type { DataSource, QueryRunner } from 'typeorm'
import { DataSource as TypeOrmDataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { UniqueAssignmentFirmwarePaletteOrder1787280000000 } from '../1787280000000-UniqueAssignmentFirmwarePaletteOrder.js'

describe('the unique Assignment, Firmware, Palette name and Screen Order migration', () => {
  let dataSource: DataSource
  let queryRunner: QueryRunner
  const migration = new UniqueAssignmentFirmwarePaletteOrder1787280000000()

  beforeEach(async () => {
    dataSource = await new TypeOrmDataSource({ type: 'postgres', driver: new PGliteDriver().driver }).initialize()
    queryRunner = dataSource.createQueryRunner()
    await queryRunner.query(`CREATE TABLE "plugin" ("id" uuid PRIMARY KEY)`)
    await queryRunner.query(`CREATE TABLE "device" ("id" uuid PRIMARY KEY, "targetFirmwareId" uuid)`)
    await queryRunner.query(`CREATE TABLE "device_plugin" ("id" uuid PRIMARY KEY, "pluginId" uuid, "deviceId" uuid)`)
    await queryRunner.query(`CREATE TABLE "screen" ("id" uuid PRIMARY KEY, "deviceId" uuid NOT NULL, "order" int NOT NULL, "devicePluginId" uuid)`)
    await queryRunner.query(`CREATE TABLE "firmware" ("id" uuid PRIMARY KEY, "version" text NOT NULL, "kind" text NOT NULL, "uploadedAt" timestamptz, "syncedAt" timestamptz)`)
    await queryRunner.query(`CREATE TABLE "palette" ("id" text PRIMARY KEY, "name" text NOT NULL, "kind" text NOT NULL)`)
  })

  afterEach(async () => {
    await queryRunner.release()
    await dataSource.destroy()
  })

  async function device(id: string, targetFirmwareId: string | null = null): Promise<void> {
    await queryRunner.query(`INSERT INTO "device" ("id", "targetFirmwareId") VALUES ('${id}', ${targetFirmwareId ? `'${targetFirmwareId}'` : 'NULL'})`)
  }

  async function plugin(id: string): Promise<void> {
    await queryRunner.query(`INSERT INTO "plugin" ("id") VALUES ('${id}')`)
  }

  async function assignment(id: string, pluginId: string, deviceId: string, screenId: string, order: number): Promise<void> {
    await queryRunner.query(`INSERT INTO "device_plugin" ("id", "pluginId", "deviceId") VALUES ('${id}', '${pluginId}', '${deviceId}')`)
    await queryRunner.query(`INSERT INTO "screen" ("id", "deviceId", "order", "devicePluginId") VALUES ('${screenId}', '${deviceId}', ${order}, '${id}')`)
  }

  async function screen(id: string, deviceId: string, order: number): Promise<void> {
    await queryRunner.query(`INSERT INTO "screen" ("id", "deviceId", "order") VALUES ('${id}', '${deviceId}', ${order})`)
  }

  async function firmware(id: string, version: string, kind: string, timestamp: string | null): Promise<void> {
    const column = kind === 'custom' ? 'uploadedAt' : 'syncedAt'
    await queryRunner.query(`INSERT INTO "firmware" ("id", "version", "kind", "${column}") VALUES ('${id}', '${version}', '${kind}', ${timestamp ? `'${timestamp}'` : 'NULL'})`)
  }

  async function palette(id: string, name: string, kind: string): Promise<void> {
    await queryRunner.query(`INSERT INTO "palette" ("id", "name", "kind") VALUES ('${id}', '${name}', '${kind}')`)
  }

  const DEVICE = '00000000-0000-4000-8000-000000000001'
  const OTHER_DEVICE = '00000000-0000-4000-8000-000000000002'
  const PLUGIN = '00000000-0000-4000-8000-000000000003'

  describe('plugin assignment', () => {
    it('keeps the Assignment whose Screen is first in the Order and closes the gap', async () => {
      await device(DEVICE)
      await plugin(PLUGIN)
      await assignment('10000000-0000-4000-8000-000000000001', PLUGIN, DEVICE, '20000000-0000-4000-8000-000000000001', 2)
      await assignment('10000000-0000-4000-8000-000000000002', PLUGIN, DEVICE, '20000000-0000-4000-8000-000000000002', 1)
      await screen('20000000-0000-4000-8000-000000000003', DEVICE, 3)

      await migration.up(queryRunner)

      const assignments: Array<{ id: string }> = await queryRunner.query(`SELECT "id" FROM "device_plugin"`)
      expect(assignments).toEqual([{ id: '10000000-0000-4000-8000-000000000002' }])
      const screens: Array<{ id: string, order: number }> = await queryRunner.query(`SELECT "id", "order" FROM "screen" ORDER BY "order"`)
      expect(screens).toEqual([
        { id: '20000000-0000-4000-8000-000000000002', order: 1 },
        { id: '20000000-0000-4000-8000-000000000003', order: 2 },
      ])
    })

    it('leaves a single Assignment per Plugin and Device as it is', async () => {
      await device(DEVICE)
      await device(OTHER_DEVICE)
      await plugin(PLUGIN)
      await assignment('10000000-0000-4000-8000-000000000001', PLUGIN, DEVICE, '20000000-0000-4000-8000-000000000001', 1)
      await assignment('10000000-0000-4000-8000-000000000002', PLUGIN, OTHER_DEVICE, '20000000-0000-4000-8000-000000000002', 1)

      await migration.up(queryRunner)

      expect(await queryRunner.query(`SELECT "id" FROM "device_plugin"`)).toHaveLength(2)
    })

    it('refuses a second Assignment of the same Plugin to a Device afterwards', async () => {
      await device(DEVICE)
      await plugin(PLUGIN)
      await assignment('10000000-0000-4000-8000-000000000001', PLUGIN, DEVICE, '20000000-0000-4000-8000-000000000001', 1)
      await migration.up(queryRunner)

      await expect(assignment('10000000-0000-4000-8000-000000000002', PLUGIN, DEVICE, '20000000-0000-4000-8000-000000000002', 2)).rejects.toThrow(/UQ_device_plugin_plugin_device/)
    })
  })

  describe('firmware version', () => {
    it('keeps a custom row over an official-synced one of the same version', async () => {
      await firmware('30000000-0000-4000-8000-000000000001', '1.5.0', 'official-synced', '2026-01-01T00:00:00.000Z')
      await firmware('30000000-0000-4000-8000-000000000002', '1.5.0', 'custom', '2026-01-02T00:00:00.000Z')

      await migration.up(queryRunner)

      const rows: Array<{ id: string }> = await queryRunner.query(`SELECT "id" FROM "firmware"`)
      expect(rows).toEqual([{ id: '30000000-0000-4000-8000-000000000002' }])
    })

    it('keeps the earlier of two of the same kind and version, and repoints a Device targeting the dropped one', async () => {
      await firmware('30000000-0000-4000-8000-000000000001', '1.5.0', 'official-synced', '2026-01-01T00:00:00.000Z')
      await firmware('30000000-0000-4000-8000-000000000002', '1.5.0', 'official-synced', '2026-01-02T00:00:00.000Z')
      await device(DEVICE, '30000000-0000-4000-8000-000000000002')

      await migration.up(queryRunner)

      expect(await queryRunner.query(`SELECT "id" FROM "firmware"`)).toEqual([{ id: '30000000-0000-4000-8000-000000000001' }])
      expect(await queryRunner.query(`SELECT "targetFirmwareId" FROM "device" WHERE "id" = '${DEVICE}'`))
        .toEqual([{ targetFirmwareId: '30000000-0000-4000-8000-000000000001' }])
    })

    it('leaves one Firmware per version as it is', async () => {
      await firmware('30000000-0000-4000-8000-000000000001', '1.5.0', 'official-synced', '2026-01-01T00:00:00.000Z')
      await firmware('30000000-0000-4000-8000-000000000002', '1.6.0', 'official-synced', '2026-01-02T00:00:00.000Z')

      await migration.up(queryRunner)

      expect(await queryRunner.query(`SELECT "id" FROM "firmware"`)).toHaveLength(2)
    })

    it('refuses a second Firmware of the same version afterwards', async () => {
      await firmware('30000000-0000-4000-8000-000000000001', '1.5.0', 'custom', '2026-01-01T00:00:00.000Z')
      await migration.up(queryRunner)

      await expect(firmware('30000000-0000-4000-8000-000000000002', '1.5.0', 'custom', '2026-01-02T00:00:00.000Z')).rejects.toThrow(/UQ_firmware_version/)
    })
  })

  describe('custom palette name', () => {
    it('renames every later same-named custom Palette, case-insensitively, keeping the earliest', async () => {
      await palette('p1', 'Ink', 'custom')
      await palette('p2', 'ink', 'custom')
      await palette('p3', 'INK', 'custom')

      await migration.up(queryRunner)

      const rows: Array<{ id: string, name: string }> = await queryRunner.query(`SELECT "id", "name" FROM "palette" ORDER BY "id"`)
      expect(rows).toEqual([
        { id: 'p1', name: 'Ink' },
        { id: 'p2', name: 'ink (2)' },
        { id: 'p3', name: 'INK (3)' },
      ])
    })

    it('leaves an official Palette of the same name as a custom one alone', async () => {
      await palette('official', 'Ink', 'official')
      await palette('custom', 'Ink', 'custom')

      await migration.up(queryRunner)

      expect(await queryRunner.query(`SELECT "name" FROM "palette" WHERE "id" = 'official'`)).toEqual([{ name: 'Ink' }])
      expect(await queryRunner.query(`SELECT "name" FROM "palette" WHERE "id" = 'custom'`)).toEqual([{ name: 'Ink' }])
    })

    it('refuses a second custom Palette of the same name, in another letter case, afterwards', async () => {
      await palette('p1', 'Ink', 'custom')
      await migration.up(queryRunner)

      await expect(palette('p2', 'INK', 'custom')).rejects.toThrow(/UQ_palette_custom_name/)
      await expect(palette('p3', 'Ink', 'official')).resolves.toBeUndefined()
    })
  })

  describe('screen order', () => {
    it('renumbers a Device whose Screens hold a racing duplicate Order, 1..N by order then id', async () => {
      await screen('20000000-0000-4000-8000-000000000001', DEVICE, 1)
      await screen('20000000-0000-4000-8000-000000000002', DEVICE, 1)
      await screen('20000000-0000-4000-8000-000000000003', DEVICE, 2)

      await migration.up(queryRunner)

      const rows: Array<{ id: string, order: number }> = await queryRunner.query(`SELECT "id", "order" FROM "screen" ORDER BY "order"`)
      expect(rows).toEqual([
        { id: '20000000-0000-4000-8000-000000000001', order: 1 },
        { id: '20000000-0000-4000-8000-000000000002', order: 2 },
        { id: '20000000-0000-4000-8000-000000000003', order: 3 },
      ])
    })

    it('leaves another Device with no duplicate Order untouched', async () => {
      await screen('20000000-0000-4000-8000-000000000001', DEVICE, 1)
      await screen('20000000-0000-4000-8000-000000000002', DEVICE, 1)
      await screen('20000000-0000-4000-8000-000000000003', OTHER_DEVICE, 5)

      await migration.up(queryRunner)

      expect(await queryRunner.query(`SELECT "order" FROM "screen" WHERE "id" = '20000000-0000-4000-8000-000000000003'`)).toEqual([{ order: 5 }])
    })

    it('refuses a second Screen of a Device at an Order already in use afterwards', async () => {
      await screen('20000000-0000-4000-8000-000000000001', DEVICE, 1)
      await migration.up(queryRunner)

      await expect(screen('20000000-0000-4000-8000-000000000002', DEVICE, 1)).rejects.toThrow(/UQ_screen_device_order/)
    })

    it('lets a reorder within one transaction pass through the moment it is complete, the constraint being deferred', async () => {
      await screen('20000000-0000-4000-8000-000000000001', DEVICE, 1)
      await screen('20000000-0000-4000-8000-000000000002', DEVICE, 2)
      await migration.up(queryRunner)

      await queryRunner.startTransaction()
      await queryRunner.query(`UPDATE "screen" SET "order" = 2 WHERE "id" = '20000000-0000-4000-8000-000000000001'`)
      await queryRunner.query(`UPDATE "screen" SET "order" = 1 WHERE "id" = '20000000-0000-4000-8000-000000000002'`)
      await queryRunner.commitTransaction()

      const rows: Array<{ id: string, order: number }> = await queryRunner.query(`SELECT "id", "order" FROM "screen" ORDER BY "order"`)
      expect(rows).toEqual([
        { id: '20000000-0000-4000-8000-000000000002', order: 1 },
        { id: '20000000-0000-4000-8000-000000000001', order: 2 },
      ])
    })
  })

  describe('down', () => {
    it('drops the four constraints and allows every duplicate again', async () => {
      await device(DEVICE)
      await plugin(PLUGIN)
      await migration.up(queryRunner)

      await migration.down(queryRunner)

      await assignment('10000000-0000-4000-8000-000000000001', PLUGIN, DEVICE, '20000000-0000-4000-8000-000000000001', 1)
      await assignment('10000000-0000-4000-8000-000000000002', PLUGIN, DEVICE, '20000000-0000-4000-8000-000000000002', 1)
      await firmware('30000000-0000-4000-8000-000000000001', '1.5.0', 'custom', '2026-01-01T00:00:00.000Z')
      await firmware('30000000-0000-4000-8000-000000000002', '1.5.0', 'custom', '2026-01-02T00:00:00.000Z')
      await palette('p1', 'Ink', 'custom')
      await palette('p2', 'ink', 'custom')

      expect(await queryRunner.query(`SELECT "id" FROM "device_plugin"`)).toHaveLength(2)
      expect(await queryRunner.query(`SELECT "id" FROM "firmware"`)).toHaveLength(2)
      expect(await queryRunner.query(`SELECT "id" FROM "palette"`)).toHaveLength(2)
    })
  })
})
