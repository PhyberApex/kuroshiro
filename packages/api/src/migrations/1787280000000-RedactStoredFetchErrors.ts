import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Before this release, a scheduled fetch's error message was stored and
 * shown unredacted (#1257): it could quote a password Plugin Field, in
 * `plugin_data_source.lastFetchError`, in a `data-source-fetch-failing`
 * Alert's `details.lastError`, in its Notification, and in the server log.
 * Every existing message is cleared here; the next scheduled fetch writes it
 * back with every password hidden, same as the editor's preview always has.
 */
export class RedactStoredFetchErrors1787280000000 implements MigrationInterface {
  name = 'RedactStoredFetchErrors1787280000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "plugin_data_source" SET "lastFetchError" = NULL WHERE "lastFetchError" IS NOT NULL`)

    await queryRunner.query(`
      UPDATE "alert" SET "details" = jsonb_set("details", '{lastError}', 'null'::jsonb)
      WHERE "kind" = 'data-source-fetch-failing' AND "details" ->> 'lastError' IS NOT NULL
    `)
  }

  public async down(): Promise<void> {
    // Data-only migration; a cleared error is written again, hidden, by the next scheduled fetch.
  }
}
