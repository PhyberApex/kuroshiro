import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * A Field Value belongs to the Plugin (ADR-0032), so a row scoped to a Device
 * has no meaning left. They are dropped rather than migrated: nothing in the
 * running app could create one, only a hand-edited Configuration Archive.
 * Rows that could not satisfy one-value-per-Plugin-Field go with them.
 */
export class DropPerDeviceFieldValues1787190000001 implements MigrationInterface {
  name = 'DropPerDeviceFieldValues1787190000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "plugin_field_value" WHERE "deviceId" IS NOT NULL OR "fieldId" IS NULL OR "pluginId" IS NULL`)
    await queryRunner.query(`DELETE FROM "plugin_field_value" a USING "plugin_field_value" b WHERE a."fieldId" = b."fieldId" AND a."id" > b."id"`)
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // The deleted rows cannot be brought back.
  }
}
