import type { FallbackSource, InstanceSettingsResponse, SettingKey, UpdateInstanceSettingsInput } from 'kuroshiro-shared'
import type { Repository } from 'typeorm'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { SETTING_KEYS } from 'kuroshiro-shared'
import { INSTANCE_SETTINGS_ID, InstanceSettings } from './entities/instance-settings.entity.js'

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

  async get(): Promise<InstanceSettingsResponse> {
    const row = await this.loadRow()
    const alertsConfig = this.alertsConfig()
    const response = {} as InstanceSettingsResponse
    for (const key of SETTING_KEYS) {
      const override = row?.[key] ?? null
      const fallbackValue = alertsConfig[key]
      response[key] = {
        override,
        value: override ?? fallbackValue,
        fallbackSource: alertsConfig[SOURCE_KEY[key]] as FallbackSource,
        fallbackValue,
      }
    }
    return response
  }

  /** Only the keys present in `input` change; a key mapped to `null` clears its override back to the fallback. */
  async update(input: UpdateInstanceSettingsInput): Promise<InstanceSettingsResponse> {
    const existing = await this.loadRow()
    const row = existing ?? this.repository.create({ id: INSTANCE_SETTINGS_ID })
    for (const key of SETTING_KEYS) {
      if (key in input)
        row[key] = input[key] ?? null
    }
    await this.repository.save(row)
    return this.get()
  }
}
