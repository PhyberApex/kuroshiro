import type { OnApplicationBootstrap } from '@nestjs/common'
import type { AlertDetails } from 'kuroshiro-shared'
import type { Repository } from 'typeorm'
import type { DigestEntry } from './notification-digest.js'
import type { AlertRule, AlertRuleContext, SweepSubjects } from './rules/alert-rule.js'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import cron from 'node-cron'
import { IsNull, Not } from 'typeorm'
import { Device } from '../devices/devices.entity.js'
import { PluginDataSource } from '../plugins/entities/plugin-data-source.entity.js'
import { InstanceSettingsService } from '../settings/instance-settings.service.js'
import { Alert } from './entities/alert.entity.js'
import { buildDigest } from './notification-digest.js'
import { NotificationSenderService } from './notification-sender.service.js'
import { ALERT_RULES } from './rules/index.js'

/**
 * Evaluates every Alert Rule against persisted state on a schedule — the
 * only place Alerts are decided (ADR-0022). Runs and persists Alerts even
 * when Apprise isn't configured; only delivery is skipped in that case.
 * Subject-agnostic (ADR-0025): every Rule declares which of `SweepSubjects`
 * it watches and how to read/write its own subject relation on `Alert` —
 * this service never touches `device`/`dataSource` directly. Delivery is
 * batched into a single digest Notification per Sweep (ADR-0022 addendum):
 * every open/resolve this Sweep decided, plus anything still unannounced
 * from an earlier one, rides in one `NotificationSenderService.send()` call.
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
    private readonly settingsService: InstanceSettingsService,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    void this.sweep().catch(err => this.logger.warn(`Initial alert sweep skipped: ${err.message}`))
    const { sweepCron } = this.configService.get<{ sweepCron: string }>('alerts')!
    cron.schedule(sweepCron, () => {
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
    const thresholds = await this.settingsService.resolveThresholds()
    const context: AlertRuleContext = {
      now: new Date(),
      ...thresholds,
    }

    const [devices, dataSources] = await Promise.all([
      this.deviceRepository.find(),
      this.dataSourceRepository.find({ relations: { plugin: true } }),
    ])
    const subjects: SweepSubjects = { devices, dataSources }

    // Snapshotted before this Sweep's own rule changes so a just-resolved Alert below isn't also picked up here as "pending".
    const pending = await this.collectPendingResolutions()

    const entries: DigestEntry[] = [...pending]
    for (const rule of ALERT_RULES)
      entries.push(...await this.sweepRule(rule, subjects, context))

    await this.deliverDigest(entries)
  }

  private async sweepRule(rule: AlertRule, subjects: SweepSubjects, context: AlertRuleContext): Promise<DigestEntry[]> {
    const activeBySubjectId = await this.loadActiveBySubjectId(rule)

    const entries: DigestEntry[] = []
    for (const subject of rule.subjects(subjects)) {
      const entry = await this.sweepSubject(rule, subject, context, activeBySubjectId.get(rule.subjectId(subject)))
      if (entry)
        entries.push(entry)
    }
    return entries
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

  private async sweepSubject(rule: AlertRule, subject: unknown, context: AlertRuleContext, existing: Alert | undefined): Promise<DigestEntry | undefined> {
    const evaluation = rule.evaluate(subject, context, !!existing)
    if (evaluation.skip)
      return undefined

    if (evaluation.active) {
      return existing
        ? this.retryOpenedNotification(rule, subject, existing, evaluation.details)
        : this.openAlert(rule, subject, evaluation.details)
    }
    if (existing)
      return this.resolveAlert(rule, subject, existing)
    return undefined
  }

  private async openAlert(rule: AlertRule, subject: unknown, details: AlertDetails | undefined): Promise<DigestEntry> {
    const now = new Date()
    const alert = await this.alertRepository.save(this.alertRepository.create({ kind: rule.kind, ...rule.toAlertSubject(subject), openedAt: now, details: details ?? null }))
    return { alertId: alert.id, kind: rule.kind, phase: 'opened', notification: rule.openedNotification(subject) }
  }

  private async retryOpenedNotification(rule: AlertRule, subject: unknown, alert: Alert, details?: AlertDetails): Promise<DigestEntry | undefined> {
    if (details) {
      // TypeORM's QueryDeepPartialEntity can't distribute over a union-typed value — see webhook-ingest.service.ts.
      await this.alertRepository.update(alert.id, { details } as Parameters<typeof this.alertRepository.update>[1])
    }
    if (alert.notifiedAt)
      return undefined
    return { alertId: alert.id, kind: rule.kind, phase: 'opened', notification: rule.openedNotification(subject) }
  }

  /**
   * Leaves `details` alone: a resolved Alert keeps the cause it last fired with.
   * With no sender configured there is nothing to deliver, so the resolution
   * is marked notified immediately instead of left pending — mirroring
   * ADR-0022's "enabling delivery later doesn't burst-notify" intent for
   * resolutions, not just active Alerts.
   */
  private async resolveAlert(rule: AlertRule, subject: unknown, alert: Alert): Promise<DigestEntry | undefined> {
    const now = new Date()
    if (!this.sender.isConfigured()) {
      await this.alertRepository.update(alert.id, { resolvedAt: now, resolutionNotifiedAt: now })
      return undefined
    }
    await this.alertRepository.update(alert.id, { resolvedAt: now })
    return { alertId: alert.id, kind: rule.kind, phase: 'resolved', notification: rule.resolvedNotification(subject) }
  }

  /** Alerts resolved on an earlier Sweep whose resolution Notification hasn't succeeded yet — carried into this Sweep's digest alongside its own changes, not sent separately. */
  private async collectPendingResolutions(): Promise<DigestEntry[]> {
    const pending = await this.alertRepository.find({
      where: { resolvedAt: Not(IsNull()), resolutionNotifiedAt: IsNull() },
      relations: { device: true, dataSource: { plugin: true } },
    })
    const entries: DigestEntry[] = []
    for (const alert of pending) {
      const rule = ALERT_RULES.find(candidate => candidate.kind === alert.kind)
      if (!rule)
        continue
      const subject = rule.subjectFromAlert(alert)
      if (subject === undefined)
        continue
      entries.push({ alertId: alert.id, kind: alert.kind, phase: 'resolved', notification: rule.resolvedNotification(subject) })
    }
    return entries
  }

  /** Delivery is all-or-nothing for the whole digest: every included entry is stamped together on success, or none on failure — each rides again in the next Sweep's digest. */
  private async deliverDigest(entries: DigestEntry[]): Promise<void> {
    const digest = buildDigest(entries)
    if (!digest)
      return

    const sent = await this.sender.send(digest)
    if (!sent)
      return

    const now = new Date()
    for (const entry of entries)
      await this.alertRepository.update(entry.alertId, entry.phase === 'opened' ? { notifiedAt: now } : { resolutionNotifiedAt: now })
  }
}
