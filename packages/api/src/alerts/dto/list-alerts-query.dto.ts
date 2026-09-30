import { IsISO8601, IsOptional } from 'class-validator'

export class ListAlertsQueryDto {
  @IsOptional()
  @IsISO8601()
  resolvedSince?: string
}
