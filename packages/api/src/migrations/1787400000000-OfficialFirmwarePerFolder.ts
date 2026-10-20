import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Official Firmware is synced once per folder of TRMNL's firmware bucket (ADR-0065), so one
 * version can have an official row per folder. Every official row so far came from
 * `trmnl_og`, and keeps its binary and its place as that folder's newest. A version stays
 * unique among custom Firmware, and per folder among official Firmware.
 *
 * `down` puts the version-wide constraint back, so it fails while one version has a row in
 * more than one folder.
 */
export class OfficialFirmwarePerFolder1787400000000 implements MigrationInterface {
  name = 'OfficialFirmwarePerFolder1787400000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "firmware" ADD "folder" text`)
    await queryRunner.query(`UPDATE "firmware" SET "folder" = 'trmnl_og' WHERE "kind" = 'official-synced'`)
    await queryRunner.query(`ALTER TABLE "firmware" DROP CONSTRAINT "UQ_firmware_version"`)
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_firmware_custom_version" ON "firmware" ("version") WHERE "kind" = 'custom'`)
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_firmware_folder_version" ON "firmware" ("folder", "version") WHERE "kind" = 'official-synced'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_firmware_folder_version"`)
    await queryRunner.query(`DROP INDEX "UQ_firmware_custom_version"`)
    await queryRunner.query(`ALTER TABLE "firmware" ADD CONSTRAINT "UQ_firmware_version" UNIQUE ("version")`)
    await queryRunner.query(`ALTER TABLE "firmware" DROP COLUMN "folder"`)
  }
}
