import type { MigrationInterface, QueryRunner } from 'typeorm'
import { parseStoredLogEntry } from '../logs/parse-log-entry.js'

const BATCH = 500

/**
 * The level and the message of a Device Log entry become columns, so the read
 * can filter and search in SQL. Existing rows get what the ingest would have
 * stored: the same function parses them, a batch at a time.
 */
export class AddDeviceLogLevelAndMessage1787260000000 implements MigrationInterface {
  name = 'AddDeviceLogLevelAndMessage1787260000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "log_entry" ADD "level" text`)
    await queryRunner.query(`ALTER TABLE "log_entry" ADD "message" text`)

    for (;;) {
      const rows: Array<{ id: string, entry: string }> = await queryRunner.query(`SELECT "id", "entry" FROM "log_entry" WHERE "level" IS NULL LIMIT ${BATCH}`)
      if (rows.length === 0)
        break
      const parsed = rows.map(({ id, entry }) => ({ id, ...parseStoredLogEntry(entry) }))
      await queryRunner.query(
        `UPDATE "log_entry" SET "level" = parsed."level", "message" = parsed."message"
         FROM unnest($1::uuid[], $2::text[], $3::text[]) AS parsed("id", "level", "message")
         WHERE "log_entry"."id" = parsed."id"`,
        [parsed.map(row => row.id), parsed.map(row => row.level), parsed.map(row => row.message)],
      )
    }

    await queryRunner.query(`ALTER TABLE "log_entry" ALTER COLUMN "level" SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE "log_entry" ALTER COLUMN "message" SET NOT NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "log_entry" DROP COLUMN "message"`)
    await queryRunner.query(`ALTER TABLE "log_entry" DROP COLUMN "level"`)
  }
}
