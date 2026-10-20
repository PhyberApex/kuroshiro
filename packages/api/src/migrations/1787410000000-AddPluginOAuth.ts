import type { MigrationInterface, QueryRunner } from 'typeorm'

/** OAuth Recipes (ADR-0067): the Recipe's `oauth_*` settings on the Plugin, and its refreshed access token as runtime state. */
export class AddPluginOAuth1787410000000 implements MigrationInterface {
  name = 'AddPluginOAuth1787410000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin" ADD "oauthSettings" jsonb`)
    await queryRunner.query(`ALTER TABLE "plugin" ADD "oauthAccessToken" text`)
    await queryRunner.query(`ALTER TABLE "plugin" ADD "oauthRefreshToken" text`)
    await queryRunner.query(`ALTER TABLE "plugin" ADD "oauthAccessTokenExpiresAt" timestamptz`)
    await queryRunner.query(`ALTER TABLE "plugin" ADD "oauthRefreshedAt" timestamptz`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plugin" DROP COLUMN "oauthRefreshedAt"`)
    await queryRunner.query(`ALTER TABLE "plugin" DROP COLUMN "oauthAccessTokenExpiresAt"`)
    await queryRunner.query(`ALTER TABLE "plugin" DROP COLUMN "oauthRefreshToken"`)
    await queryRunner.query(`ALTER TABLE "plugin" DROP COLUMN "oauthAccessToken"`)
    await queryRunner.query(`ALTER TABLE "plugin" DROP COLUMN "oauthSettings"`)
  }
}
