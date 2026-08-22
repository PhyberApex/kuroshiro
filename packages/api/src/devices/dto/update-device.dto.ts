import type { ValidationArguments, ValidationOptions } from 'class-validator'
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, registerDecorator } from 'class-validator'

const SLEEP_TIME_MAX = 86399

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

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  mac?: string

  @IsOptional()
  @IsString()
  friendlyId?: string

  @IsOptional()
  @IsString()
  batteryVoltage?: string

  @IsOptional()
  @IsString()
  fwVersion?: string

  @IsOptional()
  @IsString()
  host?: string

  @IsOptional()
  @IsNumber()
  refreshRate?: number

  @IsOptional()
  @IsString()
  rssi?: string

  @IsOptional()
  @IsString()
  userAgent?: string

  @IsOptional()
  @IsString()
  deviceModelName?: string

  @IsOptional()
  @IsString()
  paletteId?: string

  @IsOptional()
  @IsBoolean()
  mirrorEnabled?: boolean

  @IsOptional()
  @IsString()
  mirrorMac?: string

  @IsOptional()
  @IsString()
  mirrorApikey?: string

  @IsOptional()
  @IsString()
  @IsIn(['none', 'identify', 'sleep', 'add_wifi', 'restart_playlist', 'rewind', 'send_to_me'])
  specialFunction: string

  @IsOptional()
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

  @IsOptional()
  @IsBoolean()
  sleepScreenEnabled?: boolean

  @IsOptional()
  @IsBoolean()
  resetDevice: boolean

  @IsOptional()
  @IsBoolean()
  updateFirmware: boolean

  @IsOptional()
  @IsString()
  targetFirmwareId?: string
}
