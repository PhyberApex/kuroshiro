import type { SyncKind } from 'kuroshiro-shared'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { getErrorMessage } from '../utils/getErrorMessage.js'
import { SyncRun } from './entities/sync-run.entity.js'

export type SyncOutcome = { ok: true } | { ok: false, error: string }

/** Every sync with TRMNL records its outcome here, so the admin can say when TRMNL was last asked and whether it answered. */
@Injectable()
export class SyncRunService {
  private readonly logger = new Logger(SyncRunService.name)

  constructor(
    @InjectRepository(SyncRun)
    private readonly repository: Repository<SyncRun>,
  ) {}

  async record(kind: SyncKind, ranAt: Date, outcome: SyncOutcome): Promise<void> {
    await this.repository.save({ kind, ranAt, ok: outcome.ok, error: outcome.ok ? null : outcome.error })
  }

  /** Records a failed sync run, logging here instead of throwing if recording the failure itself fails, so the caller's own error is never masked by a logging failure. */
  async recordFailure(kind: SyncKind, ranAt: Date, error: unknown): Promise<void> {
    await this.record(kind, ranAt, { ok: false, error: getErrorMessage(error) })
      .catch(recordError => this.logger.error(`Could not record the failed ${kind} sync: ${getErrorMessage(recordError)}`))
  }

  last(kind: SyncKind): Promise<SyncRun | null> {
    return this.repository.findOneBy({ kind })
  }
}
