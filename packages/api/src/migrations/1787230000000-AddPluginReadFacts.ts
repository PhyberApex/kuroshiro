import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * What the Plugin reads show and nothing stored before: when a Data Source last
 * fetched successfully, when the Webhook Payload was received, when the Recipe
 * Snapshot was taken, and the last scheduled render with what stopped it.
 * Existing rows keep `NULL`, since none of it was recorded.
 */
export class AddPluginReadFacts1787230000000 implements MigrationInterface {
  name = 'AddPluginReadFacts1787230000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_data_source" ADD COLUMN "lastFetchSucceededAt" timestamptz`)
    await queryRunner.query(`
      ALTER TABLE "plugin"
        ADD COLUMN "payloadReceivedAt" timestamptz,
        ADD COLUMN "snapshotTakenAt" timestamptz,
        ADD COLUMN "lastScheduledRenderAt" timestamptz,
        ADD COLUMN "lastScheduledRenderError" text,
        ADD COLUMN "lastScheduledRenderErrorLine" integer,
        ADD COLUMN "lastScheduledRenderErrorSize" text
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "plugin"
        DROP COLUMN "lastScheduledRenderErrorSize",
        DROP COLUMN "lastScheduledRenderErrorLine",
        DROP COLUMN "lastScheduledRenderError",
        DROP COLUMN "lastScheduledRenderAt",
        DROP COLUMN "snapshotTakenAt",
        DROP COLUMN "payloadReceivedAt"
    `)
    await queryRunner.query(`ALTER TABLE "plugin_data_source" DROP COLUMN "lastFetchSucceededAt"`)
  }
}
