import type { MigrationInterface, QueryRunner } from 'typeorm'

/** Reminders (ADR-0048): the Reminder Interval Setting, unset so it falls back to its environment variable or `0` (off), and each Alert's last Reminder, empty for every existing Alert. */
export class AddAlertReminders1787360000000 implements MigrationInterface {
  name = 'AddAlertReminders1787360000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "instance_settings" ADD "alertReminderHours" integer`)
    await queryRunner.query(`ALTER TABLE "alert" ADD "remindedAt" timestamptz`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alert" DROP COLUMN "remindedAt"`)
    await queryRunner.query(`ALTER TABLE "instance_settings" DROP COLUMN "alertReminderHours"`)
  }
}
