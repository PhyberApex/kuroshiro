import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * The last sync with TRMNL, per kind, as a record of its own. An Instance that already
 * synced starts with the time of its newest synced row, read as a sync that worked.
 */
export class AddSyncRun1787240000000 implements MigrationInterface {
  name = 'AddSyncRun1787240000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "sync_run" (
        "kind" text NOT NULL,
        "ranAt" timestamptz NOT NULL,
        "ok" boolean NOT NULL,
        "error" text,
        CONSTRAINT "PK_sync_run_kind" PRIMARY KEY ("kind")
      )
    `)
    await queryRunner.query(`
      INSERT INTO "sync_run" ("kind", "ranAt", "ok", "error")
      SELECT 'firmware', MAX("syncedAt"), true, NULL FROM "firmware"
      WHERE "kind" = 'official-synced' AND "syncedAt" IS NOT NULL
      HAVING MAX("syncedAt") IS NOT NULL
    `)
    await queryRunner.query(`
      INSERT INTO "sync_run" ("kind", "ranAt", "ok", "error")
      SELECT 'device-models', MAX("syncedAt"), true, NULL FROM "device_model"
      WHERE "syncedAt" IS NOT NULL
      HAVING MAX("syncedAt") IS NOT NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "sync_run"`)
  }
}
