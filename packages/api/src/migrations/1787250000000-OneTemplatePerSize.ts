import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * A Plugin has one Template per size and always a `full` one, which is what
 * lets every render pick its Template by size. "Earliest" is the row order of
 * the table (`ctid`), which is the order a read without a sort answers them
 * in: the table has no creation time.
 *
 * Deleting the later Templates of a size drops their markup for good, so
 * `down` only takes the constraint away.
 */
export class OneTemplatePerSize1787250000000 implements MigrationInterface {
  name = 'OneTemplatePerSize1787250000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "plugin_template" template SET "layout" = 'full'
      WHERE NOT EXISTS (
        SELECT 1 FROM "plugin_template" already_full
        WHERE already_full."pluginId" = template."pluginId" AND already_full."layout" = 'full'
      )
      AND NOT EXISTS (
        SELECT 1 FROM "plugin_template" earlier
        WHERE earlier."pluginId" = template."pluginId" AND earlier."ctid" < template."ctid"
      )
    `)
    await queryRunner.query(`
      DELETE FROM "plugin_template" later
      USING "plugin_template" earlier
      WHERE later."pluginId" = earlier."pluginId"
        AND later."layout" = earlier."layout"
        AND later."ctid" > earlier."ctid"
    `)
    await queryRunner.query(`ALTER TABLE "plugin_template" ADD CONSTRAINT "UQ_plugin_template_plugin_layout" UNIQUE ("pluginId", "layout")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_template" DROP CONSTRAINT "UQ_plugin_template_plugin_layout"`)
  }
}
