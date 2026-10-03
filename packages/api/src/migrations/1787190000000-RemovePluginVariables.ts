import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Plugin Variables are removed (ADR-0032): nothing in the running app created
 * one, and nothing ever substituted them into a render.
 */
export class RemovePluginVariables1787190000000 implements MigrationInterface {
  name = 'RemovePluginVariables1787190000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "plugin_variable"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "plugin_variable" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" text NOT NULL, "value" text NOT NULL, "isSecret" boolean NOT NULL DEFAULT false, "pluginId" uuid, CONSTRAINT "PK_faf0187f42ab0e6e5118196d84f" PRIMARY KEY ("id"))`)
    await queryRunner.query(`ALTER TABLE "plugin_variable" ADD CONSTRAINT "FK_689c467e58b8f28cc10cd8cacc8" FOREIGN KEY ("pluginId") REFERENCES "plugin"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)
  }
}
