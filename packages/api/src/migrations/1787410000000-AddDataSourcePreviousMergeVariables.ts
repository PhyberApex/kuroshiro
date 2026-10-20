import type { MigrationInterface, QueryRunner } from 'typeorm'

/** Previous merge variables (ADR-0067): what a Data Source's transform returned on the last scheduled run, empty for every existing Data Source. */
export class AddDataSourcePreviousMergeVariables1787410000000 implements MigrationInterface {
  name = 'AddDataSourcePreviousMergeVariables1787410000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_data_source" ADD "previousMergeVariables" jsonb`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_data_source" DROP COLUMN "previousMergeVariables"`)
  }
}
