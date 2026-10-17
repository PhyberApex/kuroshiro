import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Whether a Screen's or a Plugin's content is dithered. On for every existing row,
 * which is how all of them were converted so far, so there is nothing to backfill.
 */
export class AddDithering1787320000000 implements MigrationInterface {
  name = 'AddDithering1787320000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "screen" ADD "dither" boolean NOT NULL DEFAULT true`)
    await queryRunner.query(`ALTER TABLE "plugin" ADD "dither" boolean NOT NULL DEFAULT true`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin" DROP COLUMN "dither"`)
    await queryRunner.query(`ALTER TABLE "screen" DROP COLUMN "dither"`)
  }
}
