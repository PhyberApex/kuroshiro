import type { AlertKind } from 'kuroshiro-shared'
import type { Repository } from 'typeorm'
import type { MetricFamily } from './prometheus-format.js'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { ALERT_KIND_LABELS } from 'kuroshiro-shared'
import { IsNull } from 'typeorm'
import { Alert } from '../alerts/entities/alert.entity.js'
import { Device } from '../devices/devices.entity.js'
import { renderPrometheusText } from './prometheus-format.js'

type MetricsDevice = Pick<Device, 'name' | 'friendlyId' | 'batteryVoltage' | 'rssi' | 'lastSeen'>
type MetricsAlert = Pick<Alert, 'kind'>

/** `undefined` for an unset or non-numeric field — `batteryVoltage`/`rssi` are optional strings, and a Device with neither should emit no sample rather than 0 or NaN. */
function parseFiniteNumber(value: string | null | undefined): number | undefined {
  if (!value)
    return undefined
  const trimmed = value.trim()
  if (trimmed === '')
    return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

function deviceLabels(device: MetricsDevice): Record<string, string> {
  return { device: device.name, friendly_id: device.friendlyId }
}

@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
  ) {}

  async render(): Promise<string> {
    const [devices, activeAlerts] = await Promise.all([
      this.deviceRepository.find({
        select: { name: true, friendlyId: true, batteryVoltage: true, rssi: true, lastSeen: true },
        loadEagerRelations: false,
      }),
      this.alertRepository.find({
        where: { resolvedAt: IsNull() },
        select: { kind: true },
      }),
    ])

    return renderPrometheusText([
      this.batteryFamily(devices),
      this.rssiFamily(devices),
      this.lastSeenFamily(devices),
      this.activeAlertsFamily(activeAlerts),
    ])
  }

  private batteryFamily(devices: MetricsDevice[]): MetricFamily {
    return this.numericDeviceFamily(devices, 'batteryVoltage', 'kuroshiro_device_battery_volts', 'Device\'s last reported battery voltage, in volts.')
  }

  private rssiFamily(devices: MetricsDevice[]): MetricFamily {
    return this.numericDeviceFamily(devices, 'rssi', 'kuroshiro_device_rssi_dbm', 'Device\'s last reported Wi-Fi signal strength, in dBm.')
  }

  /** Shared shape for the two optional-string Device fields: no sample for a Device with a missing or non-numeric value, rather than 0 or NaN. */
  private numericDeviceFamily(devices: MetricsDevice[], field: 'batteryVoltage' | 'rssi', name: string, help: string): MetricFamily {
    return {
      name,
      help,
      type: 'gauge',
      samples: devices.flatMap((device) => {
        const value = parseFiniteNumber(device[field])
        return value === undefined ? [] : [{ labels: deviceLabels(device), value }]
      }),
    }
  }

  private lastSeenFamily(devices: MetricsDevice[]): MetricFamily {
    return {
      name: 'kuroshiro_device_last_seen_timestamp_seconds',
      help: 'Unix timestamp of the Device\'s last successful poll.',
      type: 'gauge',
      samples: devices.map(device => ({
        labels: deviceLabels(device),
        value: Math.floor(device.lastSeen.getTime() / 1000),
      })),
    }
  }

  private activeAlertsFamily(activeAlerts: MetricsAlert[]): MetricFamily {
    const counts = new Map<AlertKind, number>((Object.keys(ALERT_KIND_LABELS) as AlertKind[]).map(kind => [kind, 0]))
    for (const alert of activeAlerts)
      counts.set(alert.kind, (counts.get(alert.kind) ?? 0) + 1)

    return {
      name: 'kuroshiro_alerts_active',
      help: 'Count of currently active Alerts, by kind.',
      type: 'gauge',
      samples: [...counts.entries()].map(([kind, value]) => ({ labels: { kind }, value })),
    }
  }
}
