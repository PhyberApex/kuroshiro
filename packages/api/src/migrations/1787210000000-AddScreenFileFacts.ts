import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * What a File Screen's upload was before conversion: its name, pixel size and
 * byte size. A File Screen uploaded before these columns existed keeps `NULL`.
 */
export class AddScreenFileFacts1787210000000 implements MigrationInterface {
  name = 'AddScreenFileFacts1787210000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "screen"
        ADD COLUMN "fileOriginalName" text,
        ADD COLUMN "fileWidth" integer,
        ADD COLUMN "fileHeight" integer,
        ADD COLUMN "fileBytes" integer
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "screen"
        DROP COLUMN "fileBytes",
        DROP COLUMN "fileHeight",
        DROP COLUMN "fileWidth",
        DROP COLUMN "fileOriginalName"
    `)
  }
}
