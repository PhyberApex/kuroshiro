import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Cached plugin/mashup output used to be a complete HTML document; it is now
 * device-independent body markup that gets wrapped in the device model's
 * screen shell at render time. Existing caches are dropped so every screen is
 * re-rendered in the new form.
 */
export class ResetCachedPluginOutput1787070000000 implements MigrationInterface {
  name = 'ResetCachedPluginOutput1787070000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "screen" SET "cachedPluginOutput" = NULL`)
  }

  public async down(): Promise<void> {
    // Data-only migration; caches regenerate on demand.
  }
}
