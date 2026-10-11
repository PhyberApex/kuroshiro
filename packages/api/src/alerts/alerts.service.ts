import type { AlertsList, ListAlertsQuery } from 'kuroshiro-shared'
import type { Repository } from 'typeorm'
import { HttpStatus, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, MoreThan } from 'typeorm'
import { ApiException } from '../errors/api.exception.js'
import { toAlertSummaries } from './alert.mapper.js'
import { Alert } from './entities/alert.entity.js'
import { NotificationSenderService } from './notification-sender.service.js'

const DEFAULT_RESOLVED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const RESOLVED_ALERTS_LIMIT = 50

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
    private readonly sender: NotificationSenderService,
  ) {}

  /**
   * Active Alerts (uncapped) plus resolved Alerts since `resolvedSince` (an ISO timestamp, default 7 days ago), capped at 50 after
   * filtering — both newest first. `deviceId` keeps one Device's Alerts, `pluginId` the fetch Alerts of one Plugin's Data Sources.
   */
  async list({ deviceId, pluginId, resolvedSince }: ListAlertsQuery): Promise<AlertsList> {
    const cutoff = resolvedSince ? new Date(resolvedSince) : new Date(Date.now() - DEFAULT_RESOLVED_WINDOW_MS)
    const subjectFilter = {
      ...(deviceId && { device: { id: deviceId } }),
      ...(pluginId && { dataSource: { plugin: { id: pluginId } } }),
    }

    const relations = { device: true, dataSource: { plugin: true } }

    const [active, resolved] = await Promise.all([
      this.alertRepository.find({
        where: { ...subjectFilter, resolvedAt: IsNull() },
        relations,
        order: { openedAt: 'DESC' },
      }),
      this.alertRepository.find({
        where: { ...subjectFilter, resolvedAt: MoreThan(cutoff) },
        relations,
        order: { resolvedAt: 'DESC' },
        take: RESOLVED_ALERTS_LIMIT,
      }),
    ])

    return {
      active: toAlertSummaries(active),
      resolved: toAlertSummaries(resolved),
    }
  }

  /** Exercises the real Apprise delivery path with a synthetic payload — never opens an Alert and never touches the Sweep. */
  async sendTestNotification(): Promise<{ message: string }> {
    const sent = await this.sender.send({
      title: 'Kuroshiro: Test Notification',
      body: 'This is a test Notification from Kuroshiro, sent to confirm Apprise delivery is working.',
      type: 'success',
    })

    if (sent)
      return { message: 'Test notification sent successfully.' }

    if (!this.sender.isConfigured())
      throw new ApiException(HttpStatus.BAD_REQUEST, 'notifications-off', 'Apprise is not configured — set KUROSHIRO_APPRISE_URL to enable notifications.')

    throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'notification-failed', 'Test notification failed to send. Check the Apprise sidecar and its logs.')
  }
}
