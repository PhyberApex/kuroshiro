import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddDeviceSleepMode1787130000000 implements MigrationInterface {
  name = 'AddDeviceSleepMode1787130000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "device"
      ADD COLUMN "sleepModeEnabled" boolean NOT NULL DEFAULT false,
      ADD COLUMN "sleepStartTime" integer,
      ADD COLUMN "sleepEndTime" integer,
      ADD COLUMN "sleepScreenEnabled" boolean NOT NULL DEFAULT false
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "device"
      DROP COLUMN "sleepModeEnabled",
      DROP COLUMN "sleepStartTime",
      DROP COLUMN "sleepEndTime",
      DROP COLUMN "sleepScreenEnabled"
    `)
  }
}
