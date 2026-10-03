import type { ListAlertsQuery } from 'kuroshiro-shared'
import { IsISO8601, IsOptional, IsUUID } from 'class-validator'

export class ListAlertsQueryDto implements ListAlertsQuery {
  @IsOptional()
  @IsUUID()
  deviceId?: string

  @IsOptional()
  @IsUUID()
  pluginId?: string

  @IsOptional()
  @IsISO8601()
  resolvedSince?: string
}
