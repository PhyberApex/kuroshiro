import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * A Poll-kind Plugin holds an ordered list of zero or more Data Sources.
 * Each row gets a required, per-Plugin-unique `name`, used as its
 * top-level Liquid variable key, and an `order` for the list's sequence.
 * Pre-existing rows are backfilled with the placeholder name `source` at
 * order 0 (ADR-0004) so they satisfy the new constraints; plugin authors
 * update their template's field references to the namespaced form
 * afterward.
 */
export class MultiDataSourcePlugins1787090000000 implements MigrationInterface {
  name = 'MultiDataSourcePlugins1787090000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_data_source" ADD COLUMN IF NOT EXISTS "name" text`)
    await queryRunner.query(`ALTER TABLE "plugin_data_source" ADD COLUMN IF NOT EXISTS "order" integer NOT NULL DEFAULT 0`)
    await queryRunner.query(`UPDATE "plugin_data_source" SET "name" = 'source' WHERE "name" IS NULL`)
    await queryRunner.query(`ALTER TABLE "plugin_data_source" ALTER COLUMN "name" SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE "plugin_data_source" DROP CONSTRAINT IF EXISTS "REL_42ab897c74fe88f343a4126904"`)
    await queryRunner.query(`ALTER TABLE "plugin_data_source" DROP CONSTRAINT IF EXISTS "UQ_plugin_data_source_plugin_name"`)
    await queryRunner.query(`ALTER TABLE "plugin_data_source" ADD CONSTRAINT "UQ_plugin_data_source_plugin_name" UNIQUE ("pluginId", "name")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_data_source" DROP CONSTRAINT IF EXISTS "UQ_plugin_data_source_plugin_name"`)
    await queryRunner.query(`ALTER TABLE "plugin_data_source" DROP COLUMN IF EXISTS "order"`)
    await queryRunner.query(`ALTER TABLE "plugin_data_source" DROP COLUMN IF EXISTS "name"`)
    await queryRunner.query(`ALTER TABLE "plugin_data_source" ADD CONSTRAINT "REL_42ab897c74fe88f343a4126904" UNIQUE ("pluginId")`)
  }
}
