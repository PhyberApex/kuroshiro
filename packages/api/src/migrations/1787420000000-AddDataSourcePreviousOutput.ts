import type { MigrationInterface, QueryRunner } from 'typeorm'

/** Previous Output (ADR-0070): what a Data Source's transform returned on the last scheduled run, empty for every existing Data Source. */
export class AddDataSourcePreviousOutput1787420000000 implements MigrationInterface {
  name = 'AddDataSourcePreviousOutput1787420000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_data_source" ADD "previousOutput" jsonb`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_data_source" DROP COLUMN "previousOutput"`)
  }
}
