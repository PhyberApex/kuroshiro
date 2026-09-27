import type { NotificationContent } from './rules/alert-rule.js'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const APPRISE_FETCH_TIMEOUT_MS = 15_000

/**
 * Delivers Notifications through the official `apprise-api` sidecar
 * (ADR-0022) — never throws; a missing config, a non-2xx response, a
 * timeout, or a network error all just report failure so the Alert Sweep
 * leaves the Alert's `notifiedAt`/`resolutionNotifiedAt` null and retries
 * next Sweep. The timeout matters here specifically: `AlertSweepService`
 * memoizes one in-flight sweep promise at a time (see its `sweeping` field),
 * so a `fetch` that hangs forever would silently wedge every future
 * scheduled Sweep — never just this one Notification.
 */
@Injectable()
export class NotificationSenderService {
  private readonly logger = new Logger(NotificationSenderService.name)

  constructor(private readonly configService: ConfigService) {}

  async send(payload: NotificationContent): Promise<boolean> {
    const alerts = this.configService.get<{ appriseUrl?: string, appriseKey: string }>('alerts')
    if (!alerts?.appriseUrl)
      return false

    try {
      const response = await fetch(`${alerts.appriseUrl}/notify/${alerts.appriseKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(APPRISE_FETCH_TIMEOUT_MS),
      })
      if (!response.ok) {
        this.logger.warn(`Apprise notification failed: ${response.status} ${response.statusText}`)
        return false
      }
      return true
    }
    catch (err) {
      this.logger.warn(`Apprise notification failed: ${err instanceof Error ? err.message : String(err)}`)
      return false
    }
  }
}
