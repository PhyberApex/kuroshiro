import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * `pickedScreenId` is runtime state (ADR-0038): a new feature, so there is
 * nothing to backfill.
 */
export class AddDevicePickedScreen1787300000000 implements MigrationInterface {
  name = 'AddDevicePickedScreen1787300000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "device"
      ADD COLUMN "pickedScreenId" uuid,
      ADD CONSTRAINT "FK_device_picked_screen"
        FOREIGN KEY ("pickedScreenId") REFERENCES "screen"("id") ON DELETE SET NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "device"
      DROP CONSTRAINT "FK_device_picked_screen",
      DROP COLUMN "pickedScreenId"
    `)
  }
}
