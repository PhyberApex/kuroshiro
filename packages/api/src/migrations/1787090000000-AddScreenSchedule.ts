import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddScreenSchedule1787090000000 implements MigrationInterface {
  name = 'AddScreenSchedule1787090000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "schedule" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "enabled" boolean NOT NULL DEFAULT true,
        "weekdays" integer[],
        "startTime" time,
        "endTime" time,
        "startDate" date,
        "endDate" date,
        "screenId" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_schedule_screen" UNIQUE ("screenId"),
        CONSTRAINT "FK_schedule_screen"
          FOREIGN KEY ("screenId")
          REFERENCES "screen"("id")
          ON DELETE CASCADE
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "schedule"`)
  }
}
