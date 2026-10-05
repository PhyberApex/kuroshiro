import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * The Render Signal a Screen's render last observed (`skip` for now, `hold`
 * in a later slice), remembered until its cached output changes. Runtime
 * state: excluded from the Configuration Archive and `.trmnlp` export.
 */
export class AddScreenRenderSignal1787270000000 implements MigrationInterface {
  name = 'AddScreenRenderSignal1787270000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "screen" ADD "renderSignal" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "screen" DROP COLUMN "renderSignal"`)
  }
}
