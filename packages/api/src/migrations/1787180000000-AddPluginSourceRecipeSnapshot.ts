import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * A Plugin imported from a TRMNL Recipe keeps the importer's parsed output as
 * a Recipe Snapshot alongside the already-stored source Recipe id — the base
 * a future Recipe Update Check (issue #1028) diffs against (ADR-0030). A
 * Plugin imported before this column existed gets null.
 */
export class AddPluginSourceRecipeSnapshot1787180000000 implements MigrationInterface {
  name = 'AddPluginSourceRecipeSnapshot1787180000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin" ADD COLUMN IF NOT EXISTS "sourceRecipeSnapshot" jsonb`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin" DROP COLUMN IF EXISTS "sourceRecipeSnapshot"`)
  }
}
