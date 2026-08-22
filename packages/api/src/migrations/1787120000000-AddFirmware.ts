import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddFirmware1787120000000 implements MigrationInterface {
  name = 'AddFirmware1787120000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "firmware" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "version" text NOT NULL,
        "kind" text NOT NULL,
        "checksum" text NOT NULL,
        "compatibleModels" text[] NOT NULL DEFAULT '{}',
        "deprecated" boolean NOT NULL DEFAULT false,
        "label" text,
        "syncedAt" timestamptz,
        "uploadedAt" timestamptz
      )
    `)

    await queryRunner.query(`
      ALTER TABLE "device"
      ADD COLUMN "targetFirmwareId" uuid,
      ADD CONSTRAINT "FK_device_target_firmware"
        FOREIGN KEY ("targetFirmwareId") REFERENCES "firmware"("id") ON DELETE SET NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "device"
      DROP CONSTRAINT "FK_device_target_firmware",
      DROP COLUMN "targetFirmwareId"
    `)
    await queryRunner.query(`DROP TABLE "firmware"`)
  }
}
