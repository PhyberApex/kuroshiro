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
    await this.backfillLastServed(queryRunner)
  }

  /**
   * A Device that polled before the record existed gets the closest one its
   * row can tell, so it does not read as never polled until its next poll:
   * the mirrored image, else its Active Screen, else the no-screen Fallback Screen.
   */
  private async backfillLastServed(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "device"
      SET "lastServedAt" = "lastSeen",
          "lastServedRefreshRate" = "refreshRate",
          "lastServedKind" = 'mirror',
          "lastServedImagePath" = '/screens/devices/' || "id" || '/mirror.png'
      WHERE "lastSeen" IS NOT NULL AND "mirrorEnabled" IS TRUE
    `)
    await queryRunner.query(`
      UPDATE "device"
      SET "lastServedAt" = "device"."lastSeen",
          "lastServedRefreshRate" = "device"."refreshRate",
          "lastServedKind" = 'screen',
          "lastServedScreenId" = "screen"."id",
          "lastServedImagePath" = '/screens/devices/' || "device"."id" || '/' || "screen"."id" || '.png'
      FROM "screen"
      WHERE "screen"."deviceId" = "device"."id" AND "screen"."isActive" IS TRUE
        AND "device"."lastSeen" IS NOT NULL AND "device"."lastServedKind" IS NULL
    `)
    await queryRunner.query(`
      UPDATE "device"
      SET "lastServedAt" = "lastSeen",
          "lastServedRefreshRate" = "refreshRate",
          "lastServedKind" = 'fallback',
          "lastServedFallback" = 'noScreen',
          "lastServedReason" = CASE
            WHEN EXISTS (SELECT 1 FROM "screen" WHERE "screen"."deviceId" = "device"."id") THEN 'noneEligible'
            ELSE 'noScreens'
          END,
          "lastServedImagePath" = '/screens/noScreen.png'
      WHERE "lastSeen" IS NOT NULL AND "lastServedKind" IS NULL
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
