import type { AlertThresholdKey, FallbackSource, InstanceSettingsResponse, RetentionAgeKey, RetentionAges, SettingKey, UpdateInstanceSettingsInput } from 'kuroshiro-shared'
import type { Repository } from 'typeorm'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { ALERT_THRESHOLD_KEYS, BOOLEAN_SETTING_KEYS, RETENTION_AGE_KEYS, SETTING_KEYS } from 'kuroshiro-shared'
import { INSTANCE_SETTINGS_ID, InstanceSettings } from './entities/instance-settings.entity.js'

type EnvFallbacks<K extends SettingKey> = Record<K, number> & Record<`${K}Source`, FallbackSource>

interface SettingFallback {
  value: number
  source: FallbackSource
}

/**
 * The persisted home for admin-tunable, instance-wide values (ADR-0027) — the Alert Rule
 * thresholds, the Retention ages and Firmware Auto-Update. Each numeric Setting resolves as override, else its environment variable,
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

  private fallbacks(): Record<SettingKey, SettingFallback> {
    const config: EnvFallbacks<SettingKey> = {
      ...this.configService.get<EnvFallbacks<AlertThresholdKey>>('alerts')!,
      ...this.configService.get<EnvFallbacks<RetentionAgeKey>>('retention')!,
    }
    return Object.fromEntries(
      SETTING_KEYS.map(key => [key, { value: config[key], source: config[`${key}Source`] }]),
    ) as Record<SettingKey, SettingFallback>
  }

  private async resolve<K extends SettingKey>(keys: readonly K[]): Promise<Record<K, number>> {
    const row = await this.loadRow()
    const fallbacks = this.fallbacks()
    return Object.fromEntries(
      keys.map(key => [key, row?.[key] ?? fallbacks[key].value]),
    ) as Record<K, number>
  }

  /** The resolved thresholds `AlertSweepService` builds its `AlertRuleContext` from every Sweep — never cached, so a saved override applies from the next Sweep. */
  resolveThresholds(): Promise<Record<AlertThresholdKey, number>> {
    return this.resolve(ALERT_THRESHOLD_KEYS)
  }

  /** The resolved ages `RetentionService` reads at the start of every Retention Run — never cached, so a saved override applies to the next run, dry or real. */
  resolveRetentionAges(): Promise<RetentionAges> {
    return this.resolve(RETENTION_AGE_KEYS)
  }

  /** Whether the Firmware Auto-Update policy (ADR-0029) is on — `FirmwareSyncService` reads this after every insert; the Setting has no environment-variable fallback, only the built-in default of `false`. */
  async resolveFirmwareAutoUpdate(): Promise<boolean> {
    const row = await this.loadRow()
    return row?.firmwareAutoUpdate ?? false
  }

  async get(): Promise<InstanceSettingsResponse> {
    const row = await this.loadRow()
    const fallbacks = this.fallbacks()
    const response = {} as InstanceSettingsResponse
    for (const key of SETTING_KEYS) {
      const override = row?.[key] ?? null
      const fallback = fallbacks[key]
      response[key] = {
        override,
        value: override ?? fallback.value,
        fallbackSource: fallback.source,
        fallbackValue: fallback.value,
      }
    }
    for (const key of BOOLEAN_SETTING_KEYS) {
      const override = row?.[key] ?? null
      response[key] = {
        override,
        value: override ?? false,
        fallbackSource: 'default',
        fallbackValue: false,
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
    for (const key of BOOLEAN_SETTING_KEYS) {
      if (key in input)
        row[key] = input[key] ?? null
    }
    await this.repository.save(row)
    return this.get()
  }
}
