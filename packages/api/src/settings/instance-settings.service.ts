import type { FallbackSource, InstanceSettingsResponse, SettingKey, UpdateInstanceSettingsInput } from 'kuroshiro-shared'
import type { Repository } from 'typeorm'
import type { InstanceSettingsFallbacks } from './instance-settings.mapper.js'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { BOOLEAN_SETTING_KEYS, SETTING_KEYS } from 'kuroshiro-shared'
import { INSTANCE_SETTINGS_ID, InstanceSettings } from './entities/instance-settings.entity.js'
import { toInstanceSettingsResponse } from './instance-settings.mapper.js'

interface AlertsEnvConfig {
  lowBatteryPercent: number
  lowBatteryPercentSource: FallbackSource
  offlineMultiplier: number
  offlineMultiplierSource: FallbackSource
  fetchFailureThreshold: number
  fetchFailureThresholdSource: FallbackSource
}

const SOURCE_KEY: Record<SettingKey, keyof AlertsEnvConfig> = {
  lowBatteryPercent: 'lowBatteryPercentSource',
  offlineMultiplier: 'offlineMultiplierSource',
  fetchFailureThreshold: 'fetchFailureThresholdSource',
}

/**
 * The persisted home for admin-tunable, instance-wide values (ADR-0027) — today the three
 * Alert Rule thresholds. Each Setting resolves as override, else its environment variable,
 * else the built-in default; the single row need not exist until the first save, and an
 * absent row behaves like every Setting being unset.
 */
@Injectable()
export class InstanceSettingsService {
  constructor(
    @InjectRepository(InstanceSettings)
    private readonly repository: Repository<InstanceSettings>,
    private readonly configService: ConfigService,
  ) {}

  private loadRow(): Promise<InstanceSettings | null> {
    return this.repository.findOneBy({ id: INSTANCE_SETTINGS_ID })
  }

  private alertsConfig(): AlertsEnvConfig {
    return this.configService.get<AlertsEnvConfig>('alerts')!
  }

  /** The resolved thresholds `AlertSweepService` builds its `AlertRuleContext` from every Sweep — never cached, so a saved override applies from the next Sweep. */
  async resolveThresholds(): Promise<Record<SettingKey, number>> {
    const row = await this.loadRow()
    const alertsConfig = this.alertsConfig()
    const result = {} as Record<SettingKey, number>
    for (const key of SETTING_KEYS)
      result[key] = row?.[key] ?? alertsConfig[key]
    return result
  }

  /** Whether the Firmware Auto-Update policy (ADR-0029) is on — `FirmwareSyncService` reads this after every insert; the Setting has no environment-variable fallback, only the built-in default of `false`. */
  async resolveFirmwareAutoUpdate(): Promise<boolean> {
    const row = await this.loadRow()
    return row?.firmwareAutoUpdate ?? false
  }

  private fallbacks(): InstanceSettingsFallbacks {
    const alertsConfig = this.alertsConfig()
    return Object.fromEntries(SETTING_KEYS.map(key =>
      [key, { value: alertsConfig[key], source: alertsConfig[SOURCE_KEY[key]] as FallbackSource }],
    )) as InstanceSettingsFallbacks
  }

  async get(): Promise<InstanceSettingsResponse> {
    return toInstanceSettingsResponse(await this.loadRow(), this.fallbacks())
  }

  /** Only the keys present in `input` change; a key mapped to `null` clears its override back to the fallback. */
  async update(input: UpdateInstanceSettingsInput): Promise<InstanceSettingsResponse> {
    const existing = await this.loadRow()
    const row = existing ?? this.repository.create({ id: INSTANCE_SETTINGS_ID })
    for (const key of SETTING_KEYS) {
      if (key in input)
        row[key] = input[key] ?? null
    }
    for (const key of BOOLEAN_SETTING_KEYS) {
      if (key in input)
        row[key] = input[key] ?? null
    }
    await this.repository.save(row)
    return this.get()
  }
}
