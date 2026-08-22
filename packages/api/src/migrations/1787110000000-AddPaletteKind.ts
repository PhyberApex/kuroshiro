import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPaletteKind1787110000000 implements MigrationInterface {
  name = 'AddPaletteKind1787110000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "palette" ADD "kind" text NOT NULL DEFAULT 'official'
    `)

    await queryRunner.query(`
      ALTER TABLE "palette"
        ADD CONSTRAINT "CHK_palette_kind" CHECK ("kind" IN ('official', 'custom'))
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "palette" DROP CONSTRAINT "CHK_palette_kind"`)
    await queryRunner.query(`ALTER TABLE "palette" DROP COLUMN "kind"`)
  }
}
