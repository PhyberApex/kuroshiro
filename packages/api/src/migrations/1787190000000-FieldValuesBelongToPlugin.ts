import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * A Field Value belongs to the Plugin: at most one per Plugin Field and no
 * Device dimension (ADR-0032). Per-Device rows are dropped rather than
 * migrated, since nothing in the running app could create them. Plugin Fields
 * gain select options, and Plugin Variables are removed.
 */
export class FieldValuesBelongToPlugin1787190000000 implements MigrationInterface {
  name = 'FieldValuesBelongToPlugin1787190000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "plugin_variable"`)

    await queryRunner.query(`DELETE FROM "plugin_field_value" WHERE "deviceId" IS NOT NULL OR "fieldId" IS NULL OR "pluginId" IS NULL`)
    await queryRunner.query(`DELETE FROM "plugin_field_value" a USING "plugin_field_value" b WHERE a."fieldId" = b."fieldId" AND a."id" > b."id"`)
    await queryRunner.query(`ALTER TABLE "plugin_field_value" DROP COLUMN "deviceId"`)
    await queryRunner.query(`ALTER TABLE "plugin_field_value" ALTER COLUMN "pluginId" SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE "plugin_field_value" ALTER COLUMN "fieldId" SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE "plugin_field_value" ADD CONSTRAINT "REL_4ac249bde6572aaa58d9d7855c" UNIQUE ("fieldId")`)

    await queryRunner.query(`ALTER TABLE "plugin_field" ADD COLUMN "options" jsonb`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_field" DROP COLUMN "options"`)

    await queryRunner.query(`ALTER TABLE "plugin_field_value" DROP CONSTRAINT "REL_4ac249bde6572aaa58d9d7855c"`)
    await queryRunner.query(`ALTER TABLE "plugin_field_value" ALTER COLUMN "fieldId" DROP NOT NULL`)
    await queryRunner.query(`ALTER TABLE "plugin_field_value" ALTER COLUMN "pluginId" DROP NOT NULL`)
    await queryRunner.query(`ALTER TABLE "plugin_field_value" ADD "deviceId" uuid`)
    await queryRunner.query(`ALTER TABLE "plugin_field_value" ADD CONSTRAINT "FK_671695a8c46f9825c315b60e542" FOREIGN KEY ("deviceId") REFERENCES "device"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)

    await queryRunner.query(`CREATE TABLE "plugin_variable" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" text NOT NULL, "value" text NOT NULL, "isSecret" boolean NOT NULL DEFAULT false, "pluginId" uuid, CONSTRAINT "PK_faf0187f42ab0e6e5118196d84f" PRIMARY KEY ("id"))`)
    await queryRunner.query(`ALTER TABLE "plugin_variable" ADD CONSTRAINT "FK_689c467e58b8f28cc10cd8cacc8" FOREIGN KEY ("pluginId") REFERENCES "plugin"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)
  }
}
