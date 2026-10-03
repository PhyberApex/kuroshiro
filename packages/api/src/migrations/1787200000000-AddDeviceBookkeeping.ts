import type { MigrationInterface, QueryRunner } from 'typeorm'

const NEVER_POLLED_PLACEHOLDER = '2026-04-18T22:36:39.653Z'

/**
 * `lastSeen` can say "never polled": the fixed date a Device carried until
 * its first `/display` poll becomes `NULL`, and the offline Alerts that date
 * opened go with it. The `lastServed*` columns record what the last poll was
 * answered with.
 */
export class AddDeviceBookkeeping1787200000000 implements MigrationInterface {
  name = 'AddDeviceBookkeeping1787200000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "device" ALTER COLUMN "lastSeen" DROP DEFAULT`)
    await queryRunner.query(`ALTER TABLE "device" ALTER COLUMN "lastSeen" DROP NOT NULL`)
    await queryRunner.query(`
      DELETE FROM "alert"
      WHERE "kind" = 'device-offline'
        AND "deviceId" IN (SELECT "id" FROM "device" WHERE "lastSeen" = '${NEVER_POLLED_PLACEHOLDER}')
    `)
    await queryRunner.query(`UPDATE "device" SET "lastSeen" = NULL WHERE "lastSeen" = '${NEVER_POLLED_PLACEHOLDER}'`)
    await queryRunner.query(`
      ALTER TABLE "device"
        ADD COLUMN "lastServedAt" timestamptz,
        ADD COLUMN "lastServedKind" text,
        ADD COLUMN "lastServedScreenId" uuid,
        ADD COLUMN "lastServedFallback" text,
        ADD COLUMN "lastServedReason" text,
        ADD COLUMN "lastServedRefreshRate" integer,
        ADD COLUMN "lastServedImagePath" text
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "device"
        DROP COLUMN "lastServedImagePath",
        DROP COLUMN "lastServedRefreshRate",
        DROP COLUMN "lastServedReason",
        DROP COLUMN "lastServedFallback",
        DROP COLUMN "lastServedScreenId",
        DROP COLUMN "lastServedKind",
        DROP COLUMN "lastServedAt"
    `)
    await queryRunner.query(`UPDATE "device" SET "lastSeen" = '${NEVER_POLLED_PLACEHOLDER}' WHERE "lastSeen" IS NULL`)
    await queryRunner.query(`ALTER TABLE "device" ALTER COLUMN "lastSeen" SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE "device" ALTER COLUMN "lastSeen" SET DEFAULT '${NEVER_POLLED_PLACEHOLDER}'`)
  }
}
