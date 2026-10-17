import type { MigrationInterface, QueryRunner } from 'typeorm'

/** A Wipe is a one-shot flag armed by an admin: nothing is pending on any existing Device, so there is nothing to backfill. */
export class AddDeviceWipe1787330000000 implements MigrationInterface {
  name = 'AddDeviceWipe1787330000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "device" ADD "wipe" boolean NOT NULL DEFAULT false`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "device" DROP COLUMN "wipe"`)
  }
}
