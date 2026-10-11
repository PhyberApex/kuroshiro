import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Whether a pending Device Reset also rotates `apikey` (ADR-0039). A new
 * feature, so there is nothing to backfill.
 */
export class AddDeviceResetNewApikey1787300000000 implements MigrationInterface {
  name = 'AddDeviceResetNewApikey1787300000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "device" ADD "resetDeviceNewApikey" boolean NOT NULL DEFAULT false`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "device" DROP COLUMN "resetDeviceNewApikey"`)
  }
}
