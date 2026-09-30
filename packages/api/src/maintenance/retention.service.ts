import type { OnApplicationBootstrap } from '@nestjs/common'
import type { RetentionAges, RetentionLastRun, RetentionRunResult, RetentionStatus } from 'kuroshiro-shared'
import type { FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import cron from 'node-cron'
import { LessThan } from 'typeorm'
import { Alert } from '../alerts/entities/alert.entity.js'
import { LogEntry } from '../logs/logs.entity.js'
import { getErrorMessage } from '../utils/getErrorMessage.js'

const DAILY_AT_4AM = '0 4 * * *'

/**
 * Prunes resolved Alerts and Device Log entries older than their configured
 * retention age. A dry run reports the counts a real run would delete without
 * deleting anything or updating `lastRun`. `lastRun` is in-memory only (lost
 * on restart) and is updated by both the scheduled job and a manual trigger,
 * which share this same `run` operation.
 *
 * Unlike the Device Model/Firmware syncs this schedule is modelled on, there's
 * no immediate run on boot: those syncs are idempotent upserts, but this job
 * deletes rows, so every restart silently pruning data would be surprising.
 */
@Injectable()
export class RetentionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RetentionService.name)
  private lastRun: RetentionLastRun | null = null

  constructor(
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
    @InjectRepository(LogEntry)
    private readonly logEntryRepository: Repository<LogEntry>,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    cron.schedule(DAILY_AT_4AM, () => {
      void this.run(false).catch(err => this.logger.warn(`Scheduled retention run failed: ${err.message}`))
    })
  }

  getStatus(): RetentionStatus {
    return {
      ages: this.getAges(),
      lastRun: this.lastRun,
    }
  }

  async run(dryRun: boolean): Promise<RetentionRunResult> {
    this.logger.log(`Starting retention run (dryRun: ${dryRun})`)
    const ages = this.getAges()

    const [alertsPruned, deviceLogsPruned] = await Promise.all([
      this.pruneTable(this.alertRepository, 'resolvedAt', 'resolved Alerts', ages.alertRetentionDays, dryRun),
      this.pruneTable(this.logEntryRepository, 'date', 'Device Log entries', ages.deviceLogRetentionDays, dryRun),
    ])

    const result: RetentionRunResult = { alertsPruned, deviceLogsPruned }
    this.logger.log(`Retention run complete. Pruned ${alertsPruned} Alerts, ${deviceLogsPruned} Device Log entries`)

    if (!dryRun)
      this.lastRun = { ...result, ranAt: new Date().toISOString() }

    return result
  }

  private getAges(): RetentionAges {
    return this.configService.get<RetentionAges>('retention')!
  }

  /** Shared by both tables: same age guard, same dry-run-counts-vs-deletes shape, same isolated failure handling. */
  private async pruneTable<T extends ObjectLiteral>(
    repository: Repository<T>,
    ageField: keyof T & string,
    label: string,
    retentionDays: number,
    dryRun: boolean,
  ): Promise<number> {
    if (retentionDays <= 0)
      return 0

    // TypeORM's FindOptionsWhere can't be built from a generic `keyof T` key without losing
    // its per-entity column typing — the same boundary cast as the `update()` calls in
    // alert-sweep.service.ts.
    const where = { [ageField]: LessThan(this.cutoff(retentionDays)) } as FindOptionsWhere<T>
    try {
      if (dryRun)
        return await repository.count({ where })
      const result = await repository.delete(where)
      return result.affected ?? 0
    }
    catch (err) {
      this.logger.error(`Failed to prune ${label}: ${getErrorMessage(err)}`)
      return 0
    }
  }

  private cutoff(retentionDays: number): Date {
    return new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  }
}
