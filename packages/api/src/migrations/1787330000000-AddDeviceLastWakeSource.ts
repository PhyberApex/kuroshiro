import type { MigrationInterface, QueryRunner } from 'typeorm'

/** `lastWakeSource` is the raw `Update-Source` header of the Device's last poll that sent one. */
export class AddDeviceLastWakeSource1787330000000 implements MigrationInterface {
  name = 'AddDeviceLastWakeSource1787330000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "device" ADD COLUMN "lastWakeSource" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "device" DROP COLUMN "lastWakeSource"`)
  }
}
