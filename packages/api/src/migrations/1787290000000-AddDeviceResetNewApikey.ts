import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Whether a pending Device Reset also rotates `apikey`, read and cleared
 * together with `resetDevice` in the poll that delivers it (ADR-0039).
 */
export class AddDeviceResetNewApikey1787290000000 implements MigrationInterface {
  name = 'AddDeviceResetNewApikey1787290000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "device" ADD COLUMN "resetDeviceNewApikey" boolean NOT NULL DEFAULT false`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "device" DROP COLUMN "resetDeviceNewApikey"`)
  }
}
