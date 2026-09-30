import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Adds the Fetch Failure Streak columns to `plugin_data_source` and lets
 * `alert` target a Data Source subject (ADR-0025): a nullable `dataSourceId`
 * FK (cascade delete, matching the existing Device FK), the kind CHECK
 * constraint extended with `data-source-fetch-failing`, and a partial unique
 * index enforcing at most one active Alert per Data Source.
 */
export class AddDataSourceFetchFailureAlerts1787160000000 implements MigrationInterface {
  name = 'AddDataSourceFetchFailureAlerts1787160000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "plugin_data_source"
        ADD "fetchFailureStreak" integer NOT NULL DEFAULT 0,
        ADD "lastFetchAttemptAt" timestamptz,
        ADD "lastFetchError" text
    `)

    await queryRunner.query(`ALTER TABLE "alert" ADD "dataSourceId" uuid`)

    await queryRunner.query(`
      ALTER TABLE "alert"
        ADD CONSTRAINT "FK_alert_data_source" FOREIGN KEY ("dataSourceId") REFERENCES "plugin_data_source"("id") ON DELETE CASCADE
    `)

    await queryRunner.query(`ALTER TABLE "alert" DROP CONSTRAINT "CHK_alert_kind"`)
    await queryRunner.query(`
      ALTER TABLE "alert"
        ADD CONSTRAINT "CHK_alert_kind" CHECK ("kind" IN ('device-low-battery', 'device-offline', 'data-source-fetch-failing'))
    `)

    // At most one active (unresolved) Alert per Rule per Data Source.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_alert_kind_data_source_active" ON "alert" ("kind", "dataSourceId") WHERE "resolvedAt" IS NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_alert_kind_data_source_active"`)

    await queryRunner.query(`ALTER TABLE "alert" DROP CONSTRAINT "CHK_alert_kind"`)
    await queryRunner.query(`
      ALTER TABLE "alert"
        ADD CONSTRAINT "CHK_alert_kind" CHECK ("kind" IN ('device-low-battery', 'device-offline'))
    `)

    await queryRunner.query(`ALTER TABLE "alert" DROP CONSTRAINT "FK_alert_data_source"`)
    await queryRunner.query(`ALTER TABLE "alert" DROP COLUMN "dataSourceId"`)

    await queryRunner.query(`
      ALTER TABLE "plugin_data_source"
        DROP COLUMN "lastFetchError",
        DROP COLUMN "lastFetchAttemptAt",
        DROP COLUMN "fetchFailureStreak"
    `)
  }
}
