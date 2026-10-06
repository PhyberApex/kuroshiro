import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * When a File Screen's current image was uploaded, kept apart from
 * `generatedAt` (which a re-conversion moves too). Backfilled from
 * `generatedAt` for existing File Screens: the best value there is, since
 * nothing closer to the real upload time was ever stored.
 */
export class AddScreenFileUploadedAt1787280000000 implements MigrationInterface {
  name = 'AddScreenFileUploadedAt1787280000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "screen" ADD "fileUploadedAt" timestamptz`)
    await queryRunner.query(`UPDATE "screen" SET "fileUploadedAt" = "generatedAt" WHERE "type" = 'file'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "screen" DROP COLUMN "fileUploadedAt"`)
  }
}
