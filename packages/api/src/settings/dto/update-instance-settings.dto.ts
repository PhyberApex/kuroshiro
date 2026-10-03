import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator'
import { SETTING_BOUNDS } from 'kuroshiro-shared'

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

  @IsOptional()
  @IsInt()
  @Min(SETTING_BOUNDS.alertRetentionDays.min)
  alertRetentionDays?: number | null

  @IsOptional()
  @IsInt()
  @Min(SETTING_BOUNDS.deviceLogRetentionDays.min)
  deviceLogRetentionDays?: number | null

  @IsOptional()
  @IsBoolean()
  firmwareAutoUpdate?: boolean | null
}
