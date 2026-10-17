import type { MigrationInterface, QueryRunner } from 'typeorm'

/** `rotationMode` is `automatic` (Rotation advances on every poll) or `manual` (Manual Rotation); every existing Device stays automatic. */
export class AddDeviceRotationMode1787350000000 implements MigrationInterface {
  name = 'AddDeviceRotationMode1787350000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "device" ADD COLUMN "rotationMode" text NOT NULL DEFAULT 'automatic'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "device" DROP COLUMN "rotationMode"`)
  }
}
