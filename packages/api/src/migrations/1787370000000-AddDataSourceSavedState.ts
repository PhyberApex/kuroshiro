import type { MigrationInterface, QueryRunner } from 'typeorm'

/** Saved state (ADR-0052): what a Data Source's transform keeps between scheduled runs, empty for every existing Data Source. */
export class AddDataSourceSavedState1787370000000 implements MigrationInterface {
  name = 'AddDataSourceSavedState1787370000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_data_source" ADD "savedState" jsonb`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_data_source" DROP COLUMN "savedState"`)
  }
}
