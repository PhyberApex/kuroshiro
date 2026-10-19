import type { MigrationInterface, QueryRunner } from 'typeorm'

/** Plugin Field attributes (ADR-0053): placeholder, hint, group and bounds, empty for every existing Plugin Field. */
export class AddPluginFieldAttributes1787380000000 implements MigrationInterface {
  name = 'AddPluginFieldAttributes1787380000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_field" ADD "attributes" jsonb NOT NULL DEFAULT '{}'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_field" DROP COLUMN "attributes"`)
  }
}
