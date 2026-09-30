import type { SettingKey } from 'kuroshiro-shared'
import { IsInt, IsOptional, Max, Min } from 'class-validator'

interface SettingBounds {
  min: number
  max?: number
}

// API-only (ADR-0020): validated on save, but environment-variable parsing itself stays as lenient as it was before Instance Settings.
const SETTING_BOUNDS: Record<SettingKey, SettingBounds> = {
  lowBatteryPercent: { min: 1, max: 100 },
  offlineMultiplier: { min: 2 },
  fetchFailureThreshold: { min: 1 },
}

export class UpdateInstanceSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(SETTING_BOUNDS.lowBatteryPercent.min)
  @Max(SETTING_BOUNDS.lowBatteryPercent.max!)
  lowBatteryPercent?: number | null

  @IsOptional()
  @IsInt()
  @Min(SETTING_BOUNDS.offlineMultiplier.min)
  offlineMultiplier?: number | null

  @IsOptional()
  @IsInt()
  @Min(SETTING_BOUNDS.fetchFailureThreshold.min)
  fetchFailureThreshold?: number | null
}
