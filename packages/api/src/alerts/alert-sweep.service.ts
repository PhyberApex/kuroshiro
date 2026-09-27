import type { OnApplicationBootstrap } from '@nestjs/common'
import type { Repository } from 'typeorm'
import type { AlertRule, AlertRuleContext } from './rules/alert-rule.js'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import cron from 'node-cron'
import { IsNull, Not } from 'typeorm'
import { Device } from '../devices/devices.entity.js'
import { Alert } from './entities/alert.entity.js'
import { NotificationSenderService } from './notification-sender.service.js'
import { ALERT_RULES } from './rules/index.js'

const EVERY_FIVE_MINUTES = '*/5 * * * *'

/**
 * Evaluates every Alert Rule against persisted state on a schedule — the
 * only place Alerts are decided (ADR-0022). Runs and persists Alerts even
 * when Apprise isn't configured; only delivery is skipped in that case.
 */
@Injectable()
export class AlertSweepService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AlertSweepService.name)
  private sweeping: Promise<void> | null = null

  constructor(
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    private readonly sender: NotificationSenderService,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    void this.sweep().catch(err => this.logger.warn(`Initial alert sweep skipped: ${err.message}`))
    cron.schedule(EVERY_FIVE_MINUTES, () => {
      void this.sweep().catch(err => this.logger.warn(`Scheduled alert sweep failed: ${err.message}`))
    })
  }

  /** A scheduled run and any concurrent trigger share the same in-flight promise instead of overlapping. */
  sweep(): Promise<void> {
    this.sweeping ??= this.runSweep().finally(() => {
      this.sweeping = null
    })
    return this.sweeping
  }

  private async runSweep(): Promise<void> {
    const alertsConfig = this.configService.get<{ lowBatteryPercent: number, offlineMultiplier: number }>('alerts')!
    const context: AlertRuleContext = {
      now: new Date(),
      lowBatteryPercent: alertsConfig.lowBatteryPercent,
      offlineMultiplier: alertsConfig.offlineMultiplier,
    }

    const devices = await this.deviceRepository.find()

    for (const rule of ALERT_RULES)
      await this.sweepRule(rule, devices, context)

    await this.retryPendingResolutionNotifications()
  }

  private async sweepRule(rule: AlertRule, devices: Device[], context: AlertRuleContext): Promise<void> {
    const activeAlerts = await this.alertRepository.find({ where: { kind: rule.kind, resolvedAt: IsNull() }, relations: { device: true } })
    const activeByDeviceId = new Map(activeAlerts.filter(alert => alert.device).map(alert => [alert.device!.id, alert]))

    for (const device of devices) {
      const existing = activeByDeviceId.get(device.id)
      const evaluation = rule.evaluate(device, context, !!existing)
      if (evaluation.skip)
        continue

      if (evaluation.active) {
        if (existing)
          await this.retryOpenedNotification(rule, device, existing, evaluation.details)
        else
          await this.openAlert(rule, device, evaluation.details ?? {})
      }
      else if (existing) {
        await this.resolveAlert(rule, device, existing, evaluation.details ?? {})
      }
    }
  }

  private async openAlert(rule: AlertRule, device: Device, details: Record<string, unknown>): Promise<void> {
    const now = new Date()
    const alert = await this.alertRepository.save(this.alertRepository.create({ kind: rule.kind, device, openedAt: now, details }))
    const sent = await this.sender.send(rule.openedNotification(device, details))
    if (sent)
      await this.alertRepository.update(alert.id, { notifiedAt: now })
  }

  private async retryOpenedNotification(rule: AlertRule, device: Device, alert: Alert, details?: Record<string, unknown>): Promise<void> {
    if (details) {
      // TypeORM's QueryDeepPartialEntity can't distribute over Record<string,
      // unknown> against a union-typed value — see webhook-ingest.service.ts.
      await this.alertRepository.update(alert.id, { details } as Parameters<typeof this.alertRepository.update>[1])
    }
    if (alert.notifiedAt)
      return
    const sent = await this.sender.send(rule.openedNotification(device, details ?? alert.details ?? {}))
    if (sent)
      await this.alertRepository.update(alert.id, { notifiedAt: new Date() })
  }

  private async resolveAlert(rule: AlertRule, device: Device, alert: Alert, details: Record<string, unknown>): Promise<void> {
    const now = new Date()
    await this.alertRepository.update(alert.id, { resolvedAt: now, details } as Parameters<typeof this.alertRepository.update>[1])
    const sent = await this.sender.send(rule.resolvedNotification(device, details))
    if (sent)
      await this.alertRepository.update(alert.id, { resolutionNotifiedAt: now })
  }

  /** A resolved Alert whose resolution Notification hasn't succeeded yet is retried independent of the per-Rule loop above, which only looks at active Alerts. */
  private async retryPendingResolutionNotifications(): Promise<void> {
    const pending = await this.alertRepository.find({ where: { resolvedAt: Not(IsNull()), resolutionNotifiedAt: IsNull() }, relations: { device: true } })
    for (const alert of pending) {
      if (!alert.device)
        continue
      const rule = ALERT_RULES.find(candidate => candidate.kind === alert.kind)
      if (!rule)
        continue
      const sent = await this.sender.send(rule.resolvedNotification(alert.device, alert.details ?? {}))
      if (sent)
        await this.alertRepository.update(alert.id, { resolutionNotifiedAt: new Date() })
    }
  }
}
