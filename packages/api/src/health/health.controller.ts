import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { OutsideAdminApi } from '../errors/outside-admin-api.decorator.js'
import { SkipRequestLog } from '../interceptors/skip-request-log.decorator.js'

const DATABASE_TIMEOUT_MS = 2000

export interface HealthStatus {
  status: 'ok'
  database: 'ok'
}

/**
 * The probe for orchestrators and uptime monitors: the process answers, and so
 * does the database. Fires every few seconds, so it is kept out of the request log.
 */
@Controller('health')
@OutsideAdminApi()
@SkipRequestLog()
export class HealthController {
  constructor(private readonly database: DataSource) {}

  @Get()
  async check(): Promise<HealthStatus> {
    if (!await this.databaseAnswers())
      throw new ServiceUnavailableException({ status: 'error', database: 'unreachable' })
    return { status: 'ok', database: 'ok' }
  }

  private async databaseAnswers(): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(resolve, DATABASE_TIMEOUT_MS, false)
    })
    const query = this.database.query('SELECT 1').then(() => true, () => false)
    try {
      return await Promise.race([query, timeout])
    }
    finally {
      clearTimeout(timer)
    }
  }
}
