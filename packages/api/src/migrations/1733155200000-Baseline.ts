import type { MigrationInterface, QueryRunner } from 'typeorm'

export class Baseline1733155200000 implements MigrationInterface {
  name = 'Baseline1733155200000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Baseline migration - schema already exists from synchronize: true
    // This migration creates all tables from scratch for new installations

    // Create device table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "device" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" text NOT NULL,
        "friendlyId" text NOT NULL,
        "mac" text NOT NULL,
        "apikey" text NOT NULL,
        "batteryVoltage" text,
        "fwVersion" text,
        "refreshRate" integer NOT NULL DEFAULT 300,
        "rssi" text,
        "userAgent" text,
        "width" integer,
        "height" integer,
        "mirrorEnabled" boolean,
        "mirrorMac" text,
        "mirrorApikey" text,
        "specialFunction" text NOT NULL DEFAULT 'identify',
        "resetDevice" boolean NOT NULL DEFAULT false,
        "updateFirmware" boolean NOT NULL DEFAULT false,
        "lastSeen" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_device_friendlyId" UNIQUE ("friendlyId"),
        CONSTRAINT "UQ_device_mac" UNIQUE ("mac"),
        CONSTRAINT "PK_device_id" PRIMARY KEY ("id")
      )
    `)

    // Create screen table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "screen" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "filename" text,
        "externalLink" text,
        "html" text,
        "fetchManual" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT false,
        "order" integer NOT NULL,
        "generatedAt" timestamptz NOT NULL,
        "deviceId" uuid,
        CONSTRAINT "PK_screen_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_screen_device" FOREIGN KEY ("deviceId")
          REFERENCES "device"("id") ON DELETE CASCADE
      )
    `)

    // Create log_entry table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "log_entry" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "entry" text NOT NULL,
        "date" timestamptz NOT NULL,
        "logId" integer NOT NULL,
        "deviceId" uuid,
        CONSTRAINT "PK_log_entry_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_log_entry_device" FOREIGN KEY ("deviceId")
          REFERENCES "device"("id") ON DELETE CASCADE
      )
    `)

    // Create migrations table if it doesn't exist
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "migrations" (
        "id" SERIAL PRIMARY KEY,
        "timestamp" bigint NOT NULL,
        "name" character varying NOT NULL
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all tables in reverse order
    await queryRunner.query('DROP TABLE IF EXISTS "log_entry"')
    await queryRunner.query('DROP TABLE IF EXISTS "screen"')
    await queryRunner.query('DROP TABLE IF EXISTS "device"')
  }
}
