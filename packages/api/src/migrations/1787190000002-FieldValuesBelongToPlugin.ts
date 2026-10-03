import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * A Field Value belongs to the Plugin: at most one per Plugin Field and no
 * Device dimension (ADR-0032).
 */
export class FieldValuesBelongToPlugin1787190000002 implements MigrationInterface {
  name = 'FieldValuesBelongToPlugin1787190000002'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_field_value" DROP COLUMN "deviceId"`)
    await queryRunner.query(`ALTER TABLE "plugin_field_value" ALTER COLUMN "pluginId" SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE "plugin_field_value" ALTER COLUMN "fieldId" SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE "plugin_field_value" ADD CONSTRAINT "REL_4ac249bde6572aaa58d9d7855c" UNIQUE ("fieldId")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_field_value" DROP CONSTRAINT "REL_4ac249bde6572aaa58d9d7855c"`)
    await queryRunner.query(`ALTER TABLE "plugin_field_value" ALTER COLUMN "fieldId" DROP NOT NULL`)
    await queryRunner.query(`ALTER TABLE "plugin_field_value" ALTER COLUMN "pluginId" DROP NOT NULL`)
    await queryRunner.query(`ALTER TABLE "plugin_field_value" ADD "deviceId" uuid`)
    await queryRunner.query(`ALTER TABLE "plugin_field_value" ADD CONSTRAINT "FK_671695a8c46f9825c315b60e542" FOREIGN KEY ("deviceId") REFERENCES "device"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)
  }
}
