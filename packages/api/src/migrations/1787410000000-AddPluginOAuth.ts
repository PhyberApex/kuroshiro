import type { MigrationInterface, QueryRunner } from 'typeorm'

/** OAuth Recipes (ADR-0067): the Recipe's `oauth_*` settings on the Plugin, and each Data Source's refreshed access token as runtime state. */
export class AddPluginOAuth1787410000000 implements MigrationInterface {
  name = 'AddPluginOAuth1787410000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin" ADD "oauthSettings" jsonb`)
    await queryRunner.query(`ALTER TABLE "plugin_data_source" ADD "oauthAccessToken" text`)
    await queryRunner.query(`ALTER TABLE "plugin_data_source" ADD "oauthRefreshToken" text`)
    await queryRunner.query(`ALTER TABLE "plugin_data_source" ADD "oauthAccessTokenExpiresAt" timestamptz`)
    await queryRunner.query(`ALTER TABLE "plugin_data_source" ADD "oauthRefreshedAt" timestamptz`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin_data_source" DROP COLUMN "oauthRefreshedAt"`)
    await queryRunner.query(`ALTER TABLE "plugin_data_source" DROP COLUMN "oauthAccessTokenExpiresAt"`)
    await queryRunner.query(`ALTER TABLE "plugin_data_source" DROP COLUMN "oauthRefreshToken"`)
    await queryRunner.query(`ALTER TABLE "plugin_data_source" DROP COLUMN "oauthAccessToken"`)
    await queryRunner.query(`ALTER TABLE "plugin" DROP COLUMN "oauthSettings"`)
  }
}
