import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddInstanceSettings1787170000000 implements MigrationInterface {
  name = 'AddInstanceSettings1787170000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "instance_settings" (
        "id" integer PRIMARY KEY DEFAULT 1,
        "lowBatteryPercent" integer,
        "offlineMultiplier" integer,
        "fetchFailureThreshold" integer,
        CONSTRAINT "CHK_instance_settings_singleton" CHECK ("id" = 1)
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "instance_settings"`)
  }
}
