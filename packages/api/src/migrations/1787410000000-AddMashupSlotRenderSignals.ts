import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * A Mashup slot raises its own Render Signal (ADR-0067): each slot keeps its markup in the
 * Mashup's cached output, the markup it last drew live, and the signal it raised on its own
 * page, and the Mashup whether those signals have been read. Every Mashup's cached output is
 * dropped so the next render writes its slots' markup alongside it. Runtime state: excluded
 * from the Configuration Archive like the Screen's own Render Signal.
 */
export class AddMashupSlotRenderSignals1787410000000 implements MigrationInterface {
  name = 'AddMashupSlotRenderSignals1787410000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "mashup_slot" ADD "renderedMarkup" text`)
    await queryRunner.query(`ALTER TABLE "mashup_slot" ADD "liveMarkup" text`)
    await queryRunner.query(`ALTER TABLE "mashup_slot" ADD "renderSignal" text`)
    await queryRunner.query(`ALTER TABLE "mashup_configuration" ADD "slotSignalsRead" boolean NOT NULL DEFAULT false`)
    await queryRunner.query(`UPDATE "screen" SET "cachedPluginOutput" = NULL, "renderSignal" = NULL WHERE "type" = 'mashup'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "mashup_configuration" DROP COLUMN "slotSignalsRead"`)
    await queryRunner.query(`ALTER TABLE "mashup_slot" DROP COLUMN "renderSignal"`)
    await queryRunner.query(`ALTER TABLE "mashup_slot" DROP COLUMN "liveMarkup"`)
    await queryRunner.query(`ALTER TABLE "mashup_slot" DROP COLUMN "renderedMarkup"`)
  }
}
