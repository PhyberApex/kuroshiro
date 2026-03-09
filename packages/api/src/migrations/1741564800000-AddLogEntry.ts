import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddLogEntry1741564800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "log_entry" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "entry" text NOT NULL,
        "date" timestamptz NOT NULL,
        "logId" integer NOT NULL,
        "deviceId" uuid,
        CONSTRAINT "PK_log_entry_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_log_entry_device" FOREIGN KEY ("deviceId")
          REFERENCES "device"("id") ON DELETE CASCADE
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "log_entry"`)
  }
}
