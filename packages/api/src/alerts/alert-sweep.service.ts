import type { OnApplicationBootstrap } from '@nestjs/common'
import type { Repository } from 'typeorm'
import type { AlertRule, AlertRuleContext, SweepSubjects } from './rules/alert-rule.js'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import cron from 'node-cron'
import { IsNull, Not } from 'typeorm'
import { Device } from '../devices/devices.entity.js'
import { PluginDataSource } from '../plugins/entities/plugin-data-source.entity.js'
import { Alert } from './entities/alert.entity.js'
import { NotificationSenderService } from './notification-sender.service.js'
import { ALERT_RULES } from './rules/index.js'

const EVERY_FIVE_MINUTES = '*/5 * * * *'

interface AlertsConfig {
  lowBatteryPercent: number
  offlineMultiplier: number
  fetchFailureThreshold: number
}

/**
 * Evaluates every Alert Rule against persisted state on a schedule — the
 * only place Alerts are decided (ADR-0022). Runs and persists Alerts even
 * when Apprise isn't configured; only delivery is skipped in that case.
 * Subject-agnostic (ADR-0025): every Rule declares which of `SweepSubjects`
 * it watches and how to read/write its own subject relation on `Alert` —
 * this service never touches `device`/`dataSource` directly.
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
    @InjectRepository(PluginDataSource)
    private readonly dataSourceRepository: Repository<PluginDataSource>,
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
    const alertsConfig = this.configService.get<AlertsConfig>('alerts')!
    const context: AlertRuleContext = {
      now: new Date(),
      lowBatteryPercent: alertsConfig.lowBatteryPercent,
      offlineMultiplier: alertsConfig.offlineMultiplier,
      fetchFailureThreshold: alertsConfig.fetchFailureThreshold,
    }

    const [devices, dataSources] = await Promise.all([
      this.deviceRepository.find(),
      this.dataSourceRepository.find({ relations: { plugin: true } }),
    ])
    const subjects: SweepSubjects = { devices, dataSources }

    for (const rule of ALERT_RULES)
      await this.sweepRule(rule, subjects, context)

    await this.retryPendingResolutionNotifications()
  }

  private async sweepRule(rule: AlertRule, subjects: SweepSubjects, context: AlertRuleContext): Promise<void> {
    const activeBySubjectId = await this.loadActiveBySubjectId(rule)

    for (const subject of rule.subjects(subjects))
      await this.sweepSubject(rule, subject, context, activeBySubjectId.get(rule.subjectId(subject)))
  }

  /** Keys every active Alert for this Rule by its subject id, dropping any whose subject relation is missing (`subjectFromAlert` returned `undefined`). */
  private async loadActiveBySubjectId(rule: AlertRule): Promise<Map<string, Alert>> {
    const activeAlerts = await this.alertRepository.find({ where: { kind: rule.kind, resolvedAt: IsNull() }, relations: rule.alertRelations })
    return new Map(
      activeAlerts
        .map((alert): [unknown, Alert] => [rule.subjectFromAlert(alert), alert])
        .filter((entry): entry is [NonNullable<unknown>, Alert] => entry[0] !== undefined)
        .map(([subject, alert]) => [rule.subjectId(subject), alert] as const),
    )
  }

  private async sweepSubject(rule: AlertRule, subject: unknown, context: AlertRuleContext, existing: Alert | undefined): Promise<void> {
    const evaluation = rule.evaluate(subject, context, !!existing)
    if (evaluation.skip)
      return

    if (evaluation.active) {
      if (existing)
        await this.retryOpenedNotification(rule, subject, existing, evaluation.details)
      else
        await this.openAlert(rule, subject, evaluation.details ?? {})
    }
    else if (existing) {
      await this.resolveAlert(rule, subject, existing, evaluation.details ?? {})
    }
  }

  private async openAlert(rule: AlertRule, subject: unknown, details: Record<string, unknown>): Promise<void> {
    const now = new Date()
    const alert = await this.alertRepository.save(this.alertRepository.create({ kind: rule.kind, ...rule.toAlertSubject(subject), openedAt: now, details }))
    const sent = await this.sender.send(rule.openedNotification(subject, details))
    if (sent)
      await this.alertRepository.update(alert.id, { notifiedAt: now })
  }

  private async retryOpenedNotification(rule: AlertRule, subject: unknown, alert: Alert, details?: Record<string, unknown>): Promise<void> {
    if (details) {
      // TypeORM's QueryDeepPartialEntity can't distribute over Record<string,
      // unknown> against a union-typed value — see webhook-ingest.service.ts.
      await this.alertRepository.update(alert.id, { details } as Parameters<typeof this.alertRepository.update>[1])
    }
    if (alert.notifiedAt)
      return
    const sent = await this.sender.send(rule.openedNotification(subject, details ?? alert.details ?? {}))
    if (sent)
      await this.alertRepository.update(alert.id, { notifiedAt: new Date() })
  }

  private async resolveAlert(rule: AlertRule, subject: unknown, alert: Alert, details: Record<string, unknown>): Promise<void> {
    const now = new Date()
    await this.alertRepository.update(alert.id, { resolvedAt: now, details } as Parameters<typeof this.alertRepository.update>[1])
    const sent = await this.sender.send(rule.resolvedNotification(subject, details))
    if (sent)
      await this.alertRepository.update(alert.id, { resolutionNotifiedAt: now })
  }

  /** A resolved Alert whose resolution Notification hasn't succeeded yet is retried independent of the per-Rule loop above, which only looks at active Alerts. */
  private async retryPendingResolutionNotifications(): Promise<void> {
    const pending = await this.alertRepository.find({
      where: { resolvedAt: Not(IsNull()), resolutionNotifiedAt: IsNull() },
      relations: { device: true, dataSource: { plugin: true } },
    })
    for (const alert of pending) {
      const rule = ALERT_RULES.find(candidate => candidate.kind === alert.kind)
      if (!rule)
        continue
      const subject = rule.subjectFromAlert(alert)
      if (subject === undefined)
        continue
      const sent = await this.sender.send(rule.resolvedNotification(subject, alert.details ?? {}))
      if (sent)
        await this.alertRepository.update(alert.id, { resolutionNotifiedAt: new Date() })
    }
  }
}
