import type { AlertKind, DeviceSensorKind } from 'kuroshiro-shared'
import type { Repository } from 'typeorm'
import type { MetricFamily } from './prometheus-format.js'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { ALERT_KIND_LABELS } from 'kuroshiro-shared'
import { IsNull } from 'typeorm'
import { Alert } from '../alerts/entities/alert.entity.js'
import { DeviceSensor } from '../device-sensors/entities/device-sensor.entity.js'
import { Device } from '../devices/devices.entity.js'
import { PluginDataSource } from '../plugins/entities/plugin-data-source.entity.js'
import { renderPrometheusText } from './prometheus-format.js'

type MetricsDevice = Pick<Device, 'name' | 'friendlyId' | 'batteryVoltage' | 'rssi' | 'lastSeen'>
type MetricsAlert = Pick<Alert, 'kind'>
type MetricsSensor = Pick<DeviceSensor, 'kind' | 'value' | 'unit'> & { device: Pick<Device, 'name' | 'friendlyId'> }
type MetricsDataSource = Pick<PluginDataSource, 'name' | 'mode' | 'fetchFailureStreak'> & { plugin: Pick<PluginDataSource['plugin'], 'id' | 'name'> }

/**
 * Firmware-reported unit per Sensor kind (ADR-0018: `unit` is device-reported,
 * not a Kuroshiro constant) — fixed here only to name each metric and to spot
 * a reading reported in some other unit, which is omitted rather than
 * converted.
 */
const EXPECTED_SENSOR_UNITS: Record<DeviceSensorKind, { label: string, unit: string, metricName: string }> = {
  carbon_dioxide: { label: 'carbon dioxide', unit: 'ppm', metricName: 'kuroshiro_device_sensor_carbon_dioxide_ppm' },
  humidity: { label: 'humidity', unit: '%', metricName: 'kuroshiro_device_sensor_humidity_percent' },
  pressure: { label: 'pressure', unit: 'hPa', metricName: 'kuroshiro_device_sensor_pressure_hpa' },
  temperature: { label: 'temperature', unit: 'C', metricName: 'kuroshiro_device_sensor_temperature_celsius' },
}

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
    @InjectRepository(DeviceSensor)
    private readonly sensorRepository: Repository<DeviceSensor>,
    @InjectRepository(PluginDataSource)
    private readonly dataSourceRepository: Repository<PluginDataSource>,
  ) {}

  async render(): Promise<string> {
    const [devices, activeAlerts, sensors, dataSources] = await Promise.all([
      this.deviceRepository.find({
        select: { name: true, friendlyId: true, batteryVoltage: true, rssi: true, lastSeen: true },
        loadEagerRelations: false,
      }),
      this.alertRepository.find({
        where: { resolvedAt: IsNull() },
        select: { kind: true },
      }),
      this.sensorRepository.find({
        select: { kind: true, value: true, unit: true, device: { name: true, friendlyId: true } },
        relations: { device: true },
        loadEagerRelations: false,
      }),
      this.dataSourceRepository.find({
        where: { mode: 'fetch' },
        select: { name: true, mode: true, fetchFailureStreak: true, plugin: { id: true, name: true } },
        relations: { plugin: true },
        loadEagerRelations: false,
      }),
    ])

    return renderPrometheusText([
      this.batteryFamily(devices),
      this.rssiFamily(devices),
      this.lastSeenFamily(devices),
      this.activeAlertsFamily(activeAlerts),
      ...this.sensorFamilies(sensors),
      this.fetchFailureStreakFamily(dataSources),
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
      help: 'Unix timestamp of the Device\'s last successful poll. No sample for a Device that never polled.',
      type: 'gauge',
      samples: devices.flatMap(device => device.lastSeen
        ? [{ labels: deviceLabels(device), value: Math.floor(device.lastSeen.getTime() / 1000) }]
        : []),
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

  /** One family per Sensor kind (ADR fixed unit table) — a reading reported in any other unit is omitted rather than converted. */
  private sensorFamilies(sensors: MetricsSensor[]): MetricFamily[] {
    return Object.entries(EXPECTED_SENSOR_UNITS).map(([kind, { label, unit, metricName }]) => ({
      name: metricName,
      help: `Device's last reported ${label} Sensor reading, in ${unit}. Omitted for a Device with no reading of this kind, or one reported in a different unit.`,
      type: 'gauge' as const,
      samples: sensors
        .filter(sensor => sensor.kind === kind && sensor.unit === unit)
        .map(sensor => ({ labels: deviceLabels(sensor.device), value: sensor.value })),
    }))
  }

  /** `mode` is also filtered at the query level — re-checked here so a `literal`-mode Data Source never emits a sample regardless of how it was fetched (ADR-0025: it carries no meaningful streak). */
  private fetchFailureStreakFamily(dataSources: MetricsDataSource[]): MetricFamily {
    return {
      name: 'kuroshiro_data_source_fetch_failure_streak',
      help: 'Consecutive failed scheduled fetches for a `fetch`-mode Data Source. `literal`-mode Data Sources emit no sample.',
      type: 'gauge',
      samples: dataSources
        .filter(dataSource => dataSource.mode === 'fetch')
        .map(dataSource => ({
          labels: { plugin: dataSource.plugin.name, plugin_id: dataSource.plugin.id, data_source: dataSource.name },
          value: dataSource.fetchFailureStreak,
        })),
    }
  }
}
