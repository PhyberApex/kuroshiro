import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddRetentionAgeSettings1787220000000 implements MigrationInterface {
  name = 'AddRetentionAgeSettings1787220000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "instance_settings" ADD "alertRetentionDays" integer`)
    await queryRunner.query(`ALTER TABLE "instance_settings" ADD "deviceLogRetentionDays" integer`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "instance_settings" DROP COLUMN "deviceLogRetentionDays"`)
    await queryRunner.query(`ALTER TABLE "instance_settings" DROP COLUMN "alertRetentionDays"`)
  }
}
