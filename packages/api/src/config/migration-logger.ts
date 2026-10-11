import type { QueryRunner } from 'typeorm'
import process from 'node:process'
import { AdvancedConsoleLogger } from 'typeorm'

const MIGRATION_SUCCESS = /^Migration (.+) has been executed successfully\.$/

/**
 * `app.module.ts`'s `migrationsRun: true` makes TypeORM run migrations from inside
 * `DataSource.initialize()`, so `bootstrap()` never gets `runMigrations()`'s return value
 * to log. This logger instance is shared between the two: `app.module.ts` passes it to
 * TypeORM so it captures each migration's name as it runs, and `bootstrap()` reads that
 * list back afterwards to log the one-line summary `main.ts` used to log itself.
 *
 * TypeORM's `LoggerFactory` returns a `logger` option that is already an instance as-is,
 * without applying the DataSource's `logging` option to it, so this instance must be built
 * with that option itself to keep logging the query/error/warn output `logging` already
 * controlled before this class took over as the configured logger.
 */
export class MigrationLogger extends AdvancedConsoleLogger {
  readonly ran: string[] = []

  logSchemaBuild(message: string, queryRunner?: QueryRunner): void {
    const match = MIGRATION_SUCCESS.exec(message)
    if (match)
      this.ran.push(match[1]!)
    else
      super.logSchemaBuild(message, queryRunner)
  }
}

export const migrationLogger = new MigrationLogger(process.env.NODE_ENV !== 'production')
