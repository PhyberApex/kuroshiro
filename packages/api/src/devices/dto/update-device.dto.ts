import type { ValidationArguments, ValidationOptions } from 'class-validator'
import type { UpdateDeviceInput } from 'kuroshiro-shared'
import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min, registerDecorator, ValidateIf } from 'class-validator'
import { MAC_ADDRESS_PATTERN, REFRESH_RATE_MAX, REFRESH_RATE_MIN, SPECIAL_FUNCTIONS } from 'kuroshiro-shared'
import { trimmed } from '../../utils/trimmed.js'

const SLEEP_TIME_MAX = 86399

/** For fields that cannot be cleared: an absent key is skipped, `null` is validated like any other value. */
const isSent = (_object: unknown, value: unknown): boolean => value !== undefined

function RequiresSleepWindow(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          if (value !== true)
            return true
          const dto = args.object as UpdateDeviceDto
          return dto.sleepStartTime != null && dto.sleepEndTime != null
        },
        defaultMessage(): string {
          return 'sleepModeEnabled requires both sleepStartTime and sleepEndTime to be set'
        },
      },
    })
  }
}

export class UpdateDeviceDto implements UpdateDeviceInput {
  @ValidateIf(isSent)
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  name?: string

  @ValidateIf(isSent)
  @IsInt()
  @Min(REFRESH_RATE_MIN)
  @Max(REFRESH_RATE_MAX)
  refreshRate?: number

  @ValidateIf(isSent)
  @IsString()
  deviceModelName?: string

  @ValidateIf(isSent)
  @IsString()
  paletteId?: string

  @ValidateIf(isSent)
  @IsBoolean()
  mirrorEnabled?: boolean

  @ValidateIf(isSent)
  @Transform(({ value }) => typeof value === 'string' ? value.toUpperCase() : value)
  @Matches(MAC_ADDRESS_PATTERN)
  mirrorMac?: string

  @ValidateIf(isSent)
  @IsString()
  mirrorApikey?: string

  @ValidateIf(isSent)
  @IsIn(['none', ...SPECIAL_FUNCTIONS])
  specialFunction?: UpdateDeviceInput['specialFunction']

  @ValidateIf(isSent)
  @IsBoolean()
  @RequiresSleepWindow()
  sleepModeEnabled?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(SLEEP_TIME_MAX)
  sleepStartTime?: number | null

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(SLEEP_TIME_MAX)
  sleepEndTime?: number | null

  @ValidateIf(isSent)
  @IsBoolean()
  sleepScreenEnabled?: boolean

  @ValidateIf(isSent)
  @IsBoolean()
  resetDevice?: boolean

  @ValidateIf(isSent)
  @IsBoolean()
  updateFirmware?: boolean

  @IsOptional()
  @IsString()
  targetFirmwareId?: string | null
}
