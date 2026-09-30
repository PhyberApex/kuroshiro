import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddFirmwareAutoUpdate1787180000000 implements MigrationInterface {
  name = 'AddFirmwareAutoUpdate1787180000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "instance_settings" ADD "firmwareAutoUpdate" boolean`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "instance_settings" DROP COLUMN "firmwareAutoUpdate"`)
  }
}
