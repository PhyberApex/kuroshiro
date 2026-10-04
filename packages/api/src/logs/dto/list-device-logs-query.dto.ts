import type { DeviceLogLevelFilter, DeviceLogsQuery } from 'kuroshiro-shared'
import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator'
import { DEVICE_LOG_LEVEL_FILTERS, DEVICE_LOG_PAGE_SIZE_MAX, DEVICE_LOG_SEARCH_MIN_LENGTH } from 'kuroshiro-shared'

export class ListDeviceLogsQueryDto implements DeviceLogsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(DEVICE_LOG_PAGE_SIZE_MAX)
  limit?: number

  @IsOptional()
  @IsString()
  before?: string

  @IsOptional()
  @IsString()
  after?: string

  @IsOptional()
  @IsIn(DEVICE_LOG_LEVEL_FILTERS)
  level?: DeviceLogLevelFilter

  @IsOptional()
  @IsString()
  @MinLength(DEVICE_LOG_SEARCH_MIN_LENGTH)
  q?: string
}
