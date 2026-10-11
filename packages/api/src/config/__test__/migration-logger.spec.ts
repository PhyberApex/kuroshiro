import { describe, expect, it, vi } from 'vitest'
import { MigrationLogger } from '../migration-logger.js'

describe('migrationLogger', () => {
  it('captures the name of each migration TypeORM reports as executed', () => {
    const logger = new MigrationLogger()

    logger.logSchemaBuild('3 migrations are new migrations must be executed.')
    logger.logSchemaBuild('Migration AddAlerts1787150000000 has been executed successfully.')
    logger.logSchemaBuild('Migration AddSyncRun1787240000000 has been executed successfully.')

    expect(logger.ran).toEqual(['AddAlerts1787150000000', 'AddSyncRun1787240000000'])
  })

  it('leaves every other schema-build message to the normal, logging-gated path', () => {
    const logger = new MigrationLogger()
    const passthrough = vi.spyOn(Object.getPrototypeOf(MigrationLogger.prototype), 'logSchemaBuild')

    logger.logSchemaBuild('No migrations are pending')

    expect(logger.ran).toEqual([])
    expect(passthrough).toHaveBeenCalledWith('No migrations are pending', undefined)
  })

  it('still logs a query the way AdvancedConsoleLogger would, since TypeORM never applies `logging` to a pre-built logger instance itself', () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    new MigrationLogger(true).logQuery('SELECT 1')
    expect(consoleLog).toHaveBeenCalled()

    consoleLog.mockClear()
    new MigrationLogger(false).logQuery('SELECT 1')
    expect(consoleLog).not.toHaveBeenCalled()

    consoleLog.mockRestore()
  })
})
