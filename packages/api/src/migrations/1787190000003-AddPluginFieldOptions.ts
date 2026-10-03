import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * A select-type Plugin Field keeps its options (ADR-0032), which the
 * importers used to drop.
 */
export class AddPluginFieldOptions1787190000003 implements MigrationInterface {
  name = 'AddPluginFieldOptions1787190000003'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_field" ADD COLUMN "options" jsonb`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_field" DROP COLUMN "options"`)
  }
}
