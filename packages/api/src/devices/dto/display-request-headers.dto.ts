import { IsOptional, IsString } from 'class-validator'
import { DeviceCredentialsHeadersDto } from './device-credentials-headers.dto.js'

/**
 * `refresh-rate`, `height` and `width` carry numbers but are only checked as
 * strings: the poll parses them leniently, and a garbled one costs the Device
 * that value, not its image.
 */
export class DisplayRequestHeadersDto extends DeviceCredentialsHeadersDto {
  @IsOptional()
  @IsString()
  'battery-voltage'?: string

  @IsOptional()
  @IsString()
  'fw-version'?: string

  @IsOptional()
  @IsString()
  'refresh-rate'?: string

  @IsOptional()
  @IsString()
  rssi?: string

  @IsOptional()
  @IsString()
  'user-agent'?: string

  @IsOptional()
  @IsString()
  height?: string

  @IsOptional()
  @IsString()
  width?: string

  @IsOptional()
  @IsString()
  model?: string

  @IsOptional()
  @IsString()
  'update-source'?: string

  @IsOptional()
  @IsString()
  sensors?: string
}
