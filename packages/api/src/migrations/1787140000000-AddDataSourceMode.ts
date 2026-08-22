import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddDataSourceMode1787140000000 implements MigrationInterface {
  name = 'AddDataSourceMode1787140000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "plugin_data_source"
        ADD "mode" text NOT NULL DEFAULT 'fetch',
        ADD "literalValue" jsonb,
        ALTER COLUMN "url" DROP NOT NULL
    `)

    await queryRunner.query(`
      ALTER TABLE "plugin_data_source"
        ADD CONSTRAINT "CHK_plugin_data_source_mode" CHECK ("mode" IN ('fetch', 'literal'))
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_data_source" DROP CONSTRAINT "CHK_plugin_data_source_mode"`)
    // A literal-mode row has no url — back-fill a placeholder so the
    // restored NOT NULL constraint doesn't fail on existing data.
    await queryRunner.query(`UPDATE "plugin_data_source" SET "url" = '' WHERE "url" IS NULL`)
    await queryRunner.query(`
      ALTER TABLE "plugin_data_source"
        ALTER COLUMN "url" SET NOT NULL,
        DROP COLUMN "literalValue",
        DROP COLUMN "mode"
    `)
  }
}
