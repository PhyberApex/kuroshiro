import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddWebhookPlugins1787100000000 implements MigrationInterface {
  name = 'AddWebhookPlugins1787100000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "plugin"
        ADD "webhookToken" text,
        ADD "mergeStrategy" text,
        ADD "streamLimit" integer,
        ADD "webhookPayload" jsonb
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_plugin_webhookToken" ON "plugin" ("webhookToken")
    `)

    // "kind" was an unconstrained text column nothing branched on, so a client
    // could have written any value into it before the check constraint lands.
    await queryRunner.query(`
      UPDATE "plugin" SET "kind" = 'Poll' WHERE "kind" NOT IN ('Poll', 'Webhook')
    `)

    await queryRunner.query(`
      ALTER TABLE "plugin"
        ADD CONSTRAINT "CHK_plugin_kind" CHECK ("kind" IN ('Poll', 'Webhook'))
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin" DROP CONSTRAINT "CHK_plugin_kind"`)
    await queryRunner.query(`DROP INDEX "UQ_plugin_webhookToken"`)
    await queryRunner.query(`
      ALTER TABLE "plugin"
        DROP COLUMN "webhookPayload",
        DROP COLUMN "streamLimit",
        DROP COLUMN "mergeStrategy",
        DROP COLUMN "webhookToken"
    `)
  }
}
