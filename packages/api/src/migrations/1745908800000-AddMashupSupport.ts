import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddMashupSupport1745908800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add type column to screen table
    await queryRunner.query(`
      ALTER TABLE "screen"
      ADD COLUMN "type" text NOT NULL DEFAULT 'file'
    `)

    // Backfill existing screens based on content
    await queryRunner.query(`
      UPDATE "screen"
      SET "type" = 'plugin'
      WHERE "pluginId" IS NOT NULL
    `)

    await queryRunner.query(`
      UPDATE "screen"
      SET "type" = 'html'
      WHERE "html" IS NOT NULL AND "pluginId" IS NULL
    `)

    await queryRunner.query(`
      UPDATE "screen"
      SET "type" = 'external'
      WHERE "externalLink" IS NOT NULL AND "html" IS NULL AND "pluginId" IS NULL
    `)

    // Create mashup_configuration table
    await queryRunner.query(`
      CREATE TABLE "mashup_configuration" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "layout" text NOT NULL,
        "screenId" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_mashup_configuration_screen"
          FOREIGN KEY ("screenId")
          REFERENCES "screen"("id")
          ON DELETE CASCADE
      )
    `)

    // Create mashup_slot table
    await queryRunner.query(`
      CREATE TABLE "mashup_slot" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "position" text NOT NULL,
        "size" text NOT NULL,
        "order" integer NOT NULL,
        "pluginId" uuid NOT NULL,
        "mashupConfigurationId" uuid NOT NULL,
        CONSTRAINT "FK_mashup_slot_plugin"
          FOREIGN KEY ("pluginId")
          REFERENCES "plugin"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_mashup_slot_configuration"
          FOREIGN KEY ("mashupConfigurationId")
          REFERENCES "mashup_configuration"("id")
          ON DELETE CASCADE
      )
    `)

    // Create indexes for better query performance
    await queryRunner.query(`
      CREATE INDEX "IDX_mashup_configuration_screen" ON "mashup_configuration"("screenId")
    `)

    await queryRunner.query(`
      CREATE INDEX "IDX_mashup_slot_plugin" ON "mashup_slot"("pluginId")
    `)

    await queryRunner.query(`
      CREATE INDEX "IDX_mashup_slot_configuration" ON "mashup_slot"("mashupConfigurationId")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mashup_slot_configuration"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mashup_slot_plugin"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mashup_configuration_screen"`)

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "mashup_slot"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "mashup_configuration"`)

    // Remove type column from screen table
    await queryRunner.query(`ALTER TABLE "screen" DROP COLUMN "type"`)
  }
}
