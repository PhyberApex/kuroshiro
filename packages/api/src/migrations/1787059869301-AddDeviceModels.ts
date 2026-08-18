import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddDeviceModels1787059869301 implements MigrationInterface {
  name = 'AddDeviceModels1787059869301'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "palette" (
        "id" text NOT NULL,
        "name" text NOT NULL,
        "grays" integer NOT NULL,
        "colors" text[],
        "frameworkClass" text NOT NULL,
        "grayscaleBitDepth" integer,
        "deprecated" boolean NOT NULL DEFAULT false,
        "syncedAt" timestamptz,
        CONSTRAINT "PK_palette_id" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "device_model" (
        "name" text NOT NULL,
        "label" text NOT NULL,
        "description" text,
        "width" integer NOT NULL,
        "height" integer NOT NULL,
        "colors" integer NOT NULL,
        "bitDepth" integer NOT NULL,
        "scaleFactor" double precision NOT NULL,
        "rotation" integer NOT NULL DEFAULT 0,
        "offsetX" integer NOT NULL DEFAULT 0,
        "offsetY" integer NOT NULL DEFAULT 0,
        "mimeType" text NOT NULL DEFAULT 'image/png',
        "kind" text NOT NULL,
        "paletteIds" text[] NOT NULL DEFAULT '{}',
        "cssClasses" text[] NOT NULL DEFAULT '{}',
        "cssVariables" jsonb NOT NULL DEFAULT '{}',
        "imageSizeLimit" integer,
        "deprecated" boolean NOT NULL DEFAULT false,
        "syncedAt" timestamptz,
        CONSTRAINT "PK_device_model_name" PRIMARY KEY ("name")
      )
    `)

    await queryRunner.query(`
      ALTER TABLE "device"
      ADD COLUMN "reportedModel" text,
      ADD COLUMN "deviceModelName" text,
      ADD COLUMN "paletteId" text,
      ADD CONSTRAINT "FK_device_device_model"
        FOREIGN KEY ("deviceModelName") REFERENCES "device_model"("name") ON DELETE SET NULL,
      ADD CONSTRAINT "FK_device_palette"
        FOREIGN KEY ("paletteId") REFERENCES "palette"("id") ON DELETE SET NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "device"
      DROP CONSTRAINT "FK_device_palette",
      DROP CONSTRAINT "FK_device_device_model",
      DROP COLUMN "paletteId",
      DROP COLUMN "deviceModelName",
      DROP COLUMN "reportedModel"
    `)
    await queryRunner.query(`DROP TABLE "device_model"`)
    await queryRunner.query(`DROP TABLE "palette"`)
  }
}
