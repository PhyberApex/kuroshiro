import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPluginSystem1776551799197 implements MigrationInterface {
  name = 'AddPluginSystem1776551799197'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "log_entry" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "entry" text NOT NULL,
          "date" timestamptz NOT NULL,
          "logId" integer NOT NULL,
          "deviceId" uuid,
          CONSTRAINT "PK_log_entry_id" PRIMARY KEY ("id")
        )`)
    await queryRunner.query(`ALTER TABLE "log_entry" DROP CONSTRAINT IF EXISTS "FK_log_entry_device"`)
    await queryRunner.query(`ALTER TABLE "screen" DROP CONSTRAINT IF EXISTS "FK_screen_device"`)
    await queryRunner.query(`CREATE TABLE "plugin" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "description" text, "kind" text NOT NULL DEFAULT 'Poll', "refreshInterval" integer NOT NULL DEFAULT '15', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9a65387180b2e67287345684c03" PRIMARY KEY ("id"))`)
    await queryRunner.query(`CREATE TABLE "device_plugin" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "isActive" boolean NOT NULL DEFAULT true, "order" integer NOT NULL DEFAULT '0', "deviceId" uuid, "pluginId" uuid, CONSTRAINT "PK_bc289487cb87fa4894d57bc41b5" PRIMARY KEY ("id"))`)
    await queryRunner.query(`CREATE TABLE "plugin_data_source" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "method" text NOT NULL DEFAULT 'GET', "url" text NOT NULL, "headers" jsonb, "body" jsonb, "transformJs" text, "pluginId" uuid, CONSTRAINT "REL_42ab897c74fe88f343a4126904" UNIQUE ("pluginId"), CONSTRAINT "PK_e25c6f85098c550750f03018107" PRIMARY KEY ("id"))`)
    await queryRunner.query(`CREATE TABLE "plugin_field" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "keyname" text NOT NULL, "fieldType" text NOT NULL DEFAULT 'string', "name" text NOT NULL, "description" text, "defaultValue" text, "required" boolean NOT NULL DEFAULT false, "order" integer NOT NULL DEFAULT '0', "pluginId" uuid, CONSTRAINT "PK_5a8f7103c77a78be9d3eaebeb23" PRIMARY KEY ("id"))`)
    await queryRunner.query(`CREATE TABLE "plugin_field_value" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "value" text NOT NULL, "pluginId" uuid, "fieldId" uuid, "deviceId" uuid, CONSTRAINT "PK_b1def4e8307b71c7015fd68434a" PRIMARY KEY ("id"))`)
    await queryRunner.query(`CREATE TABLE "plugin_template" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "layout" text NOT NULL DEFAULT 'full', "liquidMarkup" text NOT NULL, "lastRenderedAt" TIMESTAMP WITH TIME ZONE, "pluginId" uuid, CONSTRAINT "PK_b1ad51c7ef10153fc1b80e917a7" PRIMARY KEY ("id"))`)
    await queryRunner.query(`CREATE TABLE "plugin_variable" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" text NOT NULL, "value" text NOT NULL, "isSecret" boolean NOT NULL DEFAULT false, "pluginId" uuid, CONSTRAINT "PK_faf0187f42ab0e6e5118196d84f" PRIMARY KEY ("id"))`)
    await queryRunner.query(`ALTER TABLE "screen" ADD "cachedPluginOutput" text`)
    await queryRunner.query(`ALTER TABLE "screen" ADD "devicePluginId" uuid`)
    await queryRunner.query(`ALTER TABLE "screen" ADD "pluginId" uuid`)
    await queryRunner.query(`ALTER TABLE "device" ALTER COLUMN "lastSeen" SET DEFAULT '"2026-04-18T22:36:39.653Z"'`)
    await queryRunner.query(`ALTER TABLE "log_entry" ADD CONSTRAINT "FK_279159e616ea17eba352e988242" FOREIGN KEY ("deviceId") REFERENCES "device"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)
    await queryRunner.query(`ALTER TABLE "screen" ADD CONSTRAINT "FK_6cb4f31b6d941025f95573be999" FOREIGN KEY ("deviceId") REFERENCES "device"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)
    await queryRunner.query(`ALTER TABLE "screen" ADD CONSTRAINT "FK_dc49b148393f4373e0d0b9b451d" FOREIGN KEY ("pluginId") REFERENCES "plugin"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)
    await queryRunner.query(`ALTER TABLE "device_plugin" ADD CONSTRAINT "FK_bcf332253aeef61ec3982b06f95" FOREIGN KEY ("deviceId") REFERENCES "device"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)
    await queryRunner.query(`ALTER TABLE "device_plugin" ADD CONSTRAINT "FK_ab6ecea6cb905626e4d87fd102c" FOREIGN KEY ("pluginId") REFERENCES "plugin"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)
    await queryRunner.query(`ALTER TABLE "plugin_data_source" ADD CONSTRAINT "FK_42ab897c74fe88f343a4126904c" FOREIGN KEY ("pluginId") REFERENCES "plugin"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)
    await queryRunner.query(`ALTER TABLE "plugin_field" ADD CONSTRAINT "FK_ab61301d6a24662aae07b592ea7" FOREIGN KEY ("pluginId") REFERENCES "plugin"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)
    await queryRunner.query(`ALTER TABLE "plugin_field_value" ADD CONSTRAINT "FK_3aaef93d5e372ce9ec1ebb6635e" FOREIGN KEY ("pluginId") REFERENCES "plugin"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)
    await queryRunner.query(`ALTER TABLE "plugin_field_value" ADD CONSTRAINT "FK_4ac249bde6572aaa58d9d7855c5" FOREIGN KEY ("fieldId") REFERENCES "plugin_field"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)
    await queryRunner.query(`ALTER TABLE "plugin_field_value" ADD CONSTRAINT "FK_671695a8c46f9825c315b60e542" FOREIGN KEY ("deviceId") REFERENCES "device"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)
    await queryRunner.query(`ALTER TABLE "plugin_template" ADD CONSTRAINT "FK_5f773f5720e2de7f9228c7b24f2" FOREIGN KEY ("pluginId") REFERENCES "plugin"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)
    await queryRunner.query(`ALTER TABLE "plugin_variable" ADD CONSTRAINT "FK_689c467e58b8f28cc10cd8cacc8" FOREIGN KEY ("pluginId") REFERENCES "plugin"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_variable" DROP CONSTRAINT "FK_689c467e58b8f28cc10cd8cacc8"`)
    await queryRunner.query(`ALTER TABLE "plugin_template" DROP CONSTRAINT "FK_5f773f5720e2de7f9228c7b24f2"`)
    await queryRunner.query(`ALTER TABLE "plugin_field_value" DROP CONSTRAINT "FK_671695a8c46f9825c315b60e542"`)
    await queryRunner.query(`ALTER TABLE "plugin_field_value" DROP CONSTRAINT "FK_4ac249bde6572aaa58d9d7855c5"`)
    await queryRunner.query(`ALTER TABLE "plugin_field_value" DROP CONSTRAINT "FK_3aaef93d5e372ce9ec1ebb6635e"`)
    await queryRunner.query(`ALTER TABLE "plugin_field" DROP CONSTRAINT "FK_ab61301d6a24662aae07b592ea7"`)
    await queryRunner.query(`ALTER TABLE "plugin_data_source" DROP CONSTRAINT "FK_42ab897c74fe88f343a4126904c"`)
    await queryRunner.query(`ALTER TABLE "device_plugin" DROP CONSTRAINT "FK_ab6ecea6cb905626e4d87fd102c"`)
    await queryRunner.query(`ALTER TABLE "device_plugin" DROP CONSTRAINT "FK_bcf332253aeef61ec3982b06f95"`)
    await queryRunner.query(`ALTER TABLE "screen" DROP CONSTRAINT "FK_dc49b148393f4373e0d0b9b451d"`)
    await queryRunner.query(`ALTER TABLE "screen" DROP CONSTRAINT "FK_6cb4f31b6d941025f95573be999"`)
    await queryRunner.query(`ALTER TABLE "log_entry" DROP CONSTRAINT "FK_279159e616ea17eba352e988242"`)
    await queryRunner.query(`ALTER TABLE "device" ALTER COLUMN "lastSeen" SET DEFAULT now()`)
    await queryRunner.query(`ALTER TABLE "screen" DROP COLUMN "pluginId"`)
    await queryRunner.query(`ALTER TABLE "screen" DROP COLUMN "devicePluginId"`)
    await queryRunner.query(`ALTER TABLE "screen" DROP COLUMN "cachedPluginOutput"`)
    await queryRunner.query(`DROP TABLE "plugin_variable"`)
    await queryRunner.query(`DROP TABLE "plugin_template"`)
    await queryRunner.query(`DROP TABLE "plugin_field_value"`)
    await queryRunner.query(`DROP TABLE "plugin_field"`)
    await queryRunner.query(`DROP TABLE "plugin_data_source"`)
    await queryRunner.query(`DROP TABLE "device_plugin"`)
    await queryRunner.query(`DROP TABLE "plugin"`)
    await queryRunner.query(`ALTER TABLE "screen" ADD CONSTRAINT "FK_screen_device" FOREIGN KEY ("deviceId") REFERENCES "device"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)
    await queryRunner.query(`ALTER TABLE "log_entry" ADD CONSTRAINT "FK_log_entry_device" FOREIGN KEY ("deviceId") REFERENCES "device"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)
  }
}
