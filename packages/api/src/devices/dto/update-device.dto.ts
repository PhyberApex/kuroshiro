import { IsBoolean, IsIn, IsNumber, IsOptional, IsString } from 'class-validator'

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
  @IsNumber()
  width?: number

  @IsOptional()
  @IsNumber()
  height?: number

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
  resetDevice: boolean

  @IsOptional()
  @IsBoolean()
  updateFirmware: boolean
}
