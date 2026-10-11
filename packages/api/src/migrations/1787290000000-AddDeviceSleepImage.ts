import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * When a Device's own sleep image was last stored or reconverted; `null`
 * while it has none. A new feature, so there is nothing to backfill.
 */
export class AddDeviceSleepImage1787290000000 implements MigrationInterface {
  name = 'AddDeviceSleepImage1787290000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "device" ADD "sleepImageGeneratedAt" timestamptz`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "device" DROP COLUMN "sleepImageGeneratedAt"`)
  }
}
