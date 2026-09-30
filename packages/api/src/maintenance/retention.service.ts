import type { OnApplicationBootstrap } from '@nestjs/common'
import type { RetentionLastRun, RetentionRunResult, RetentionStatus } from 'kuroshiro-shared'
import type { Repository } from 'typeorm'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import cron from 'node-cron'
import { LessThan } from 'typeorm'
import { Alert } from '../alerts/entities/alert.entity.js'
import { LogEntry } from '../logs/logs.entity.js'
import { getErrorMessage } from '../utils/getErrorMessage.js'

const DAILY_AT_4AM = '0 4 * * *'

interface RetentionConfig {
  alertRetentionDays: number
  deviceLogRetentionDays: number
}

/**
 * Prunes resolved Alerts and Device Log entries older than their configured
 * retention age. A dry run reports the counts a real run would delete without
 * deleting anything or updating `lastRun`. `lastRun` is in-memory only (lost
 * on restart) and is updated by both the scheduled job and a manual trigger,
 * which share this same `run` operation.
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
      this.pruneAlerts(ages.alertRetentionDays, dryRun),
      this.pruneDeviceLogs(ages.deviceLogRetentionDays, dryRun),
    ])

    const result: RetentionRunResult = { alertsPruned, deviceLogsPruned }
    this.logger.log(`Retention run complete. Pruned ${alertsPruned} Alerts, ${deviceLogsPruned} Device Log entries`)

    if (!dryRun)
      this.lastRun = { ...result, ranAt: new Date().toISOString() }

    return result
  }

  private getAges(): RetentionConfig {
    return this.configService.get<RetentionConfig>('retention')!
  }

  private async pruneAlerts(retentionDays: number, dryRun: boolean): Promise<number> {
    if (retentionDays <= 0)
      return 0

    const where = { resolvedAt: LessThan(this.cutoff(retentionDays)) }
    try {
      if (dryRun)
        return await this.alertRepository.count({ where })
      const result = await this.alertRepository.delete(where)
      return result.affected ?? 0
    }
    catch (err) {
      this.logger.error(`Failed to prune resolved Alerts: ${getErrorMessage(err)}`)
      return 0
    }
  }

  private async pruneDeviceLogs(retentionDays: number, dryRun: boolean): Promise<number> {
    if (retentionDays <= 0)
      return 0

    const where = { date: LessThan(this.cutoff(retentionDays)) }
    try {
      if (dryRun)
        return await this.logEntryRepository.count({ where })
      const result = await this.logEntryRepository.delete(where)
      return result.affected ?? 0
    }
    catch (err) {
      this.logger.error(`Failed to prune Device Log entries: ${getErrorMessage(err)}`)
      return 0
    }
  }

  private cutoff(retentionDays: number): Date {
    return new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  }
}
