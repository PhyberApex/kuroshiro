import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * A Plugin imported from a TRMNL Recipe stores the source Recipe's numeric
 * id as inert metadata — nothing reads it yet, but a future "check for
 * updates" feature won't need a backfill migration (issue #796, ADR-0011).
 */
export class AddPluginSourceRecipeId1787095000000 implements MigrationInterface {
  name = 'AddPluginSourceRecipeId1787095000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin" ADD COLUMN IF NOT EXISTS "sourceRecipeId" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin" DROP COLUMN IF EXISTS "sourceRecipeId"`)
  }
}
