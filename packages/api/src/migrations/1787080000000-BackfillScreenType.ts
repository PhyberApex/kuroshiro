import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * ScreensService.add() and PluginsService.assignToDevice() never set
 * Screen.type, so every external/html/plugin screen created after the
 * one-off backfill in AddMashupSupport was stored as the 'file' default.
 * Re-applies that same backfill now that both call sites set type correctly.
 */
export class BackfillScreenType1787080000000 implements MigrationInterface {
  name = 'BackfillScreenType1787080000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "screen"
      SET "type" = 'plugin'
      WHERE "pluginId" IS NOT NULL AND "type" != 'plugin'
    `)

    await queryRunner.query(`
      UPDATE "screen"
      SET "type" = 'html'
      WHERE "html" IS NOT NULL AND "pluginId" IS NULL AND "type" != 'html'
    `)

    await queryRunner.query(`
      UPDATE "screen"
      SET "type" = 'external'
      WHERE "externalLink" IS NOT NULL AND "html" IS NULL AND "pluginId" IS NULL AND "type" != 'external'
    `)
  }

  public async down(): Promise<void> {
    // Data-only migration; original 'file' values are not recoverable.
  }
}
