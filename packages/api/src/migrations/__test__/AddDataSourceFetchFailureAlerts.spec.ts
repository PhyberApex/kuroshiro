import type { QueryRunner } from 'typeorm'
import { describe, expect, it, vi } from 'vitest'
import { AddDataSourceFetchFailureAlerts1787160000000 } from '../1787160000000-AddDataSourceFetchFailureAlerts.js'

function makeQueryRunner() {
  return { query: vi.fn().mockResolvedValue(undefined) } as unknown as QueryRunner
}

describe('addDataSourceFetchFailureAlerts1787160000000', () => {
  describe('up', () => {
    it('adds the three Fetch Failure Streak columns to plugin_data_source', async () => {
      const queryRunner = makeQueryRunner()
      await new AddDataSourceFetchFailureAlerts1787160000000().up(queryRunner)

      const queries = (queryRunner.query as ReturnType<typeof vi.fn>).mock.calls.map(call => call[0] as string)
      expect(queries.some(q => q.includes('ALTER TABLE "plugin_data_source"') && q.includes('"fetchFailureStreak" integer NOT NULL DEFAULT 0') && q.includes('"lastFetchAttemptAt" timestamptz') && q.includes('"lastFetchError" text'))).toBe(true)
    })

    it('adds a nullable cascading dataSourceId FK on alert', async () => {
      const queryRunner = makeQueryRunner()
      await new AddDataSourceFetchFailureAlerts1787160000000().up(queryRunner)

      const queries = (queryRunner.query as ReturnType<typeof vi.fn>).mock.calls.map(call => call[0] as string)
      expect(queries.some(q => q.includes('ADD "dataSourceId" uuid'))).toBe(true)
      expect(queries.some(q => q.includes('FK_alert_data_source') && q.includes('REFERENCES "plugin_data_source"("id") ON DELETE CASCADE'))).toBe(true)
    })

    it('extends the kind CHECK constraint with the new Alert kind', async () => {
      const queryRunner = makeQueryRunner()
      await new AddDataSourceFetchFailureAlerts1787160000000().up(queryRunner)

      const queries = (queryRunner.query as ReturnType<typeof vi.fn>).mock.calls.map(call => call[0] as string)
      expect(queries.some(q => q.includes('DROP CONSTRAINT "CHK_alert_kind"'))).toBe(true)
      expect(queries.some(q => q.includes('CHK_alert_kind') && q.includes(`'data-source-fetch-failing'`))).toBe(true)
    })

    it('creates a partial unique index enforcing at most one active Alert per Data Source', async () => {
      const queryRunner = makeQueryRunner()
      await new AddDataSourceFetchFailureAlerts1787160000000().up(queryRunner)

      const queries = (queryRunner.query as ReturnType<typeof vi.fn>).mock.calls.map(call => call[0] as string)
      expect(queries.some(q => q.includes('CREATE UNIQUE INDEX "UQ_alert_kind_data_source_active"') && q.includes('("kind", "dataSourceId")') && q.includes('WHERE "resolvedAt" IS NULL'))).toBe(true)
    })
  })

  describe('down', () => {
    it('reverses every up() change', async () => {
      const queryRunner = makeQueryRunner()
      await new AddDataSourceFetchFailureAlerts1787160000000().down(queryRunner)

      const queries = (queryRunner.query as ReturnType<typeof vi.fn>).mock.calls.map(call => call[0] as string)
      expect(queries.some(q => q.includes('DROP INDEX "UQ_alert_kind_data_source_active"'))).toBe(true)
      expect(queries.some(q => q.includes('DROP CONSTRAINT "FK_alert_data_source"'))).toBe(true)
      expect(queries.some(q => q.includes('DROP COLUMN "dataSourceId"'))).toBe(true)
      expect(queries.some(q => q.includes('DROP COLUMN "fetchFailureStreak"'))).toBe(true)
      expect(queries.some(q => q.includes(`CHK_alert_kind" CHECK ("kind" IN ('device-low-battery', 'device-offline'))`))).toBe(true)
    })
  })
})
