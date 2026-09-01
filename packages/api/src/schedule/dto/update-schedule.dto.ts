import { ArrayUnique, IsArray, IsBoolean, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator'
import { CALENDAR_DATE_PATTERN, TIME_OF_DAY_PATTERN } from './schedule-field-patterns.js'

/**
 * Every field is optional and nullable: omitting one leaves it untouched,
 * sending `null` clears the constraint it carries.
 */
export class UpdateScheduleDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @ArrayUnique()
  weekdays?: number[] | null

  @IsOptional()
  @IsString()
  @Matches(TIME_OF_DAY_PATTERN, { message: 'startTime must be a HH:MM time of day' })
  startTime?: string | null

  @IsOptional()
  @IsString()
  @Matches(TIME_OF_DAY_PATTERN, { message: 'endTime must be a HH:MM time of day' })
  endTime?: string | null

  @IsOptional()
  @IsString()
  @Matches(CALENDAR_DATE_PATTERN, { message: 'startDate must be a YYYY-MM-DD date' })
  startDate?: string | null

  @IsOptional()
  @IsString()
  @Matches(CALENDAR_DATE_PATTERN, { message: 'endDate must be a YYYY-MM-DD date' })
  endDate?: string | null
}
