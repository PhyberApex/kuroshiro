import type { SyncKind } from 'kuroshiro-shared'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SyncRun } from './entities/sync-run.entity.js'

export type SyncOutcome = { ok: true } | { ok: false, error: string }

/** Every sync with TRMNL records its outcome here, so the admin can say when TRMNL was last asked and whether it answered. */
@Injectable()
export class SyncRunService {
  constructor(
    @InjectRepository(SyncRun)
    private readonly repository: Repository<SyncRun>,
  ) {}

  async record(kind: SyncKind, ranAt: Date, outcome: SyncOutcome): Promise<void> {
    await this.repository.save({ kind, ranAt, ok: outcome.ok, error: outcome.ok ? null : outcome.error })
  }

  last(kind: SyncKind): Promise<SyncRun | null> {
    return this.repository.findOneBy({ kind })
  }
}
