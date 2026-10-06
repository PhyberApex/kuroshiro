import type { MigrationInterface, QueryRunner } from 'typeorm'
import { Logger } from '@nestjs/common'

const logger = new Logger('UniqueAssignmentFirmwarePaletteOrder1787280000000')

/**
 * Backs four "only one of" rules, so far checked only by a racy read-then-write
 * in the service, with a real constraint: a Plugin Assignment per (Plugin,
 * Device), a Firmware per version, a custom Palette per name (case-insensitive),
 * and an Order number per Device's Screen (ADR follow-up to #1199, #1209, #1253).
 *
 * Existing data may already hold duplicates the checks let through, so `up`
 * resolves them first, the way the maintainer decided for each:
 * - Plugin Assignment: keeps the Assignment whose Screen is first in the
 *   Order, deletes the others with their Screens, then closes the gap.
 * - Firmware: keeps a custom row over an official-synced one, then the
 *   earliest by `uploadedAt`/`syncedAt` (both null for the other kind,
 *   `COALESCE` compares them on one timeline), then `id`; repoints any
 *   Device targeting a dropped row to the kept one. The file of a dropped
 *   row is orphaned on disk; nothing here can delete it.
 * - Custom Palette: renames every later same-named row to "<name> (2)",
 *   "(3)", ... "Earliest" is the table's own row order (`ctid`), as for
 *   `OneTemplatePerSize`: neither table carries a creation time.
 * - Screen Order: renumbers each affected Device's Screens 1..N by
 *   (`order`, `id`), what `closeGapInOrder` already does.
 *
 * `down` only drops the four constraints: nothing deleted or renamed comes
 * back.
 */
export class UniqueAssignmentFirmwarePaletteOrder1787280000000 implements MigrationInterface {
  name = 'UniqueAssignmentFirmwarePaletteOrder1787280000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.dedupePluginAssignments(queryRunner)
    await queryRunner.query(`ALTER TABLE "device_plugin" ADD CONSTRAINT "UQ_device_plugin_plugin_device" UNIQUE ("pluginId", "deviceId")`)

    await this.dedupeFirmwareVersions(queryRunner)
    await queryRunner.query(`ALTER TABLE "firmware" ADD CONSTRAINT "UQ_firmware_version" UNIQUE ("version")`)

    await this.dedupeCustomPaletteNames(queryRunner)
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_palette_custom_name" ON "palette" (lower("name")) WHERE "kind" = 'custom'`)

    await this.dedupeScreenOrders(queryRunner)
    await queryRunner.query(`ALTER TABLE "screen" ADD CONSTRAINT "UQ_screen_device_order" UNIQUE ("deviceId", "order") DEFERRABLE INITIALLY DEFERRED`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "screen" DROP CONSTRAINT "UQ_screen_device_order"`)
    await queryRunner.query(`DROP INDEX "UQ_palette_custom_name"`)
    await queryRunner.query(`ALTER TABLE "firmware" DROP CONSTRAINT "UQ_firmware_version"`)
    await queryRunner.query(`ALTER TABLE "device_plugin" DROP CONSTRAINT "UQ_device_plugin_plugin_device"`)
  }

  private async dedupePluginAssignments(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TEMP TABLE "_dup_plugin_assignment" AS
      SELECT dp.id AS "devicePluginId", s.id AS "screenId", dp."deviceId"
      FROM "device_plugin" dp
      JOIN "screen" s ON s."devicePluginId" = dp.id
      WHERE dp.id NOT IN (
        SELECT DISTINCT ON (dp2."pluginId", dp2."deviceId") dp2.id
        FROM "device_plugin" dp2
        JOIN "screen" s2 ON s2."devicePluginId" = dp2.id
        ORDER BY dp2."pluginId", dp2."deviceId", s2."order" ASC
      )
    `)
    const dropped: Array<{ devicePluginId: string, deviceId: string }> = await queryRunner.query(`SELECT "devicePluginId", "deviceId" FROM "_dup_plugin_assignment"`)
    if (dropped.length > 0) {
      await queryRunner.query(`DELETE FROM "screen" WHERE id IN (SELECT "screenId" FROM "_dup_plugin_assignment")`)
      await queryRunner.query(`DELETE FROM "device_plugin" WHERE id IN (SELECT "devicePluginId" FROM "_dup_plugin_assignment")`)
      await queryRunner.query(`
        UPDATE "screen" s SET "order" = numbered.rn
        FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY "deviceId" ORDER BY "order", id) AS rn
          FROM "screen"
          WHERE "deviceId" IN (SELECT DISTINCT "deviceId" FROM "_dup_plugin_assignment")
        ) numbered
        WHERE numbered.id = s.id AND numbered.rn != s."order"
      `)
      logger.log(`Deduplicated ${dropped.length} racing Plugin Assignment(s): ${dropped.map(row => row.devicePluginId).join(', ')}`)
    }
    await queryRunner.query(`DROP TABLE "_dup_plugin_assignment"`)
  }

  private async dedupeFirmwareVersions(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TEMP TABLE "_dup_firmware" AS
      SELECT loser.id AS "loserId", keeper.id AS "keeperId", loser.version
      FROM (
        SELECT id, version, ROW_NUMBER() OVER (
          PARTITION BY version
          ORDER BY (kind = 'custom') DESC, COALESCE("uploadedAt", "syncedAt") ASC, id ASC
        ) AS rn
        FROM "firmware"
      ) loser
      JOIN (
        SELECT id, version, ROW_NUMBER() OVER (
          PARTITION BY version
          ORDER BY (kind = 'custom') DESC, COALESCE("uploadedAt", "syncedAt") ASC, id ASC
        ) AS rn
        FROM "firmware"
      ) keeper ON keeper.version = loser.version AND keeper.rn = 1
      WHERE loser.rn > 1
    `)
    const dropped: Array<{ loserId: string, keeperId: string, version: string }> = await queryRunner.query(`SELECT "loserId", "keeperId", version FROM "_dup_firmware"`)
    if (dropped.length > 0) {
      await queryRunner.query(`
        UPDATE "device" d SET "targetFirmwareId" = df."keeperId"
        FROM "_dup_firmware" df
        WHERE d."targetFirmwareId" = df."loserId"
      `)
      await queryRunner.query(`DELETE FROM "firmware" WHERE id IN (SELECT "loserId" FROM "_dup_firmware")`)
      logger.log(`Deduplicated ${dropped.length} racing Firmware version(s), kept over dropped: ${dropped.map(row => `${row.version} (${row.keeperId} over ${row.loserId})`).join(', ')}. The dropped rows' binaries, if any, are now orphaned on disk.`)
    }
    await queryRunner.query(`DROP TABLE "_dup_firmware"`)
  }

  private async dedupeCustomPaletteNames(queryRunner: QueryRunner): Promise<void> {
    const [renamed]: [Array<{ id: string, name: string }>] = await queryRunner.query(`
      UPDATE "palette" p
      SET "name" = ranked.name || ' (' || ranked.rn || ')'
      FROM (
        SELECT id, "name", ROW_NUMBER() OVER (PARTITION BY lower("name") ORDER BY ctid) AS rn
        FROM "palette"
        WHERE "kind" = 'custom'
      ) ranked
      WHERE ranked.id = p.id AND ranked.rn > 1
      RETURNING p.id, p."name"
    `)
    if (renamed.length > 0)
      logger.log(`Renamed ${renamed.length} racing custom Palette(s) to keep their name unique: ${renamed.map(row => `${row.id} -> "${row.name}"`).join(', ')}`)
  }

  private async dedupeScreenOrders(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TEMP TABLE "_dup_screen_order_device" AS
      SELECT DISTINCT "deviceId" FROM "screen"
      GROUP BY "deviceId", "order" HAVING count(*) > 1
    `)
    const affected: Array<{ deviceId: string }> = await queryRunner.query(`SELECT "deviceId" FROM "_dup_screen_order_device"`)
    if (affected.length > 0) {
      await queryRunner.query(`
        UPDATE "screen" s SET "order" = numbered.rn
        FROM (
          SELECT sc.id, ROW_NUMBER() OVER (PARTITION BY sc."deviceId" ORDER BY sc."order", sc.id) AS rn
          FROM "screen" sc
          JOIN "_dup_screen_order_device" d ON d."deviceId" = sc."deviceId"
        ) numbered
        WHERE numbered.id = s.id AND numbered.rn != s."order"
      `)
      logger.log(`Renumbered the Screen Order of ${affected.length} Device(s) that held a racing duplicate Order: ${affected.map(row => row.deviceId).join(', ')}`)
    }
    await queryRunner.query(`DROP TABLE "_dup_screen_order_device"`)
  }
}
