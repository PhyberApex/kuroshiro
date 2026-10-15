import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * A Plugin's own TRMNL Framework Version; `null` means the Instance pin, which
 * is what every existing Plugin keeps using, so there is nothing to backfill.
 */
export class AddPluginFrameworkVersion1787310000000 implements MigrationInterface {
  name = 'AddPluginFrameworkVersion1787310000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin" ADD "frameworkVersion" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin" DROP COLUMN "frameworkVersion"`)
  }
}
