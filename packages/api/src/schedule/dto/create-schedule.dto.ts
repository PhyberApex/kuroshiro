import { ArrayUnique, IsArray, IsBoolean, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator'
import { CALENDAR_DATE_PATTERN, TIME_OF_DAY_PATTERN } from './schedule-field-patterns'

export class CreateScheduleDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @ArrayUnique()
  weekdays?: number[]

  @IsOptional()
  @IsString()
  @Matches(TIME_OF_DAY_PATTERN, { message: 'startTime must be a HH:MM time of day' })
  startTime?: string

  @IsOptional()
  @IsString()
  @Matches(TIME_OF_DAY_PATTERN, { message: 'endTime must be a HH:MM time of day' })
  endTime?: string

  @IsOptional()
  @IsString()
  @Matches(CALENDAR_DATE_PATTERN, { message: 'startDate must be a YYYY-MM-DD date' })
  startDate?: string

  @IsOptional()
  @IsString()
  @Matches(CALENDAR_DATE_PATTERN, { message: 'endDate must be a YYYY-MM-DD date' })
  endDate?: string
}
