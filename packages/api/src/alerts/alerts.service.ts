import type { AlertsList, AlertSummary, ListAlertsQuery } from 'kuroshiro-shared'
import type { Repository } from 'typeorm'
import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, MoreThan } from 'typeorm'
import { Alert } from './entities/alert.entity.js'
import { NotificationSenderService } from './notification-sender.service.js'

const DEFAULT_RESOLVED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const RESOLVED_ALERTS_LIMIT = 50

/** `undefined` for an Alert whose subject relation (Device or Data Source) is missing — cascade-deleted, or deleted between the query and the join. */
function toSummary(alert: Alert): AlertSummary | undefined {
  const subject = alert.device
    ? { deviceId: alert.device.id, deviceName: alert.device.name }
    : alert.dataSource
      ? {
          pluginId: alert.dataSource.plugin.id,
          pluginName: alert.dataSource.plugin.name,
          dataSourceId: alert.dataSource.id,
          dataSourceName: alert.dataSource.name,
        }
      : undefined
  if (!subject)
    return undefined
  return {
    id: alert.id,
    kind: alert.kind,
    ...subject,
    openedAt: alert.openedAt.toISOString(),
    resolvedAt: alert.resolvedAt ? alert.resolvedAt.toISOString() : null,
    details: alert.details ?? null,
  }
}

function toSummaries(alerts: Alert[]): AlertSummary[] {
  return alerts.map(toSummary).filter((summary): summary is AlertSummary => summary !== undefined)
}

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
  async list({ deviceId, pluginId, resolvedSince }: ListAlertsQuery = {}): Promise<AlertsList> {
    const cutoff = resolvedSince ? new Date(resolvedSince) : new Date(Date.now() - DEFAULT_RESOLVED_WINDOW_MS)
    const subject = {
      ...(deviceId && { device: { id: deviceId } }),
      ...(pluginId && { dataSource: { plugin: { id: pluginId } } }),
    }

    const [active, resolved] = await Promise.all([
      this.alertRepository.find({
        where: { ...subject, resolvedAt: IsNull() },
        relations: { device: true, dataSource: { plugin: true } },
        order: { openedAt: 'DESC' },
      }),
      this.alertRepository.find({
        where: { ...subject, resolvedAt: MoreThan(cutoff) },
        relations: { device: true, dataSource: { plugin: true } },
        order: { resolvedAt: 'DESC' },
        take: RESOLVED_ALERTS_LIMIT,
      }),
    ])

    return {
      active: toSummaries(active),
      resolved: toSummaries(resolved),
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
      throw new BadRequestException('Apprise is not configured — set KUROSHIRO_APPRISE_URL to enable notifications.')

    throw new ServiceUnavailableException('Test notification failed to send. Check the Apprise sidecar and its logs.')
  }
}
