import type { MigrationInterface, QueryRunner } from 'typeorm'

/** Screen modifiers (ADR-0054): TRMNL's no_screen_padding and dark_mode on the Plugin, off for every existing one. */
export class AddPluginScreenModifiers1787390000000 implements MigrationInterface {
  name = 'AddPluginScreenModifiers1787390000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin" ADD "noScreenPadding" boolean NOT NULL DEFAULT false`)
    await queryRunner.query(`ALTER TABLE "plugin" ADD "darkMode" boolean NOT NULL DEFAULT false`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin" DROP COLUMN "darkMode"`)
    await queryRunner.query(`ALTER TABLE "plugin" DROP COLUMN "noScreenPadding"`)
  }
}
