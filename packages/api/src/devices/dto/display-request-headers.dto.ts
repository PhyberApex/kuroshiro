import { IsNumberString, IsOptional, IsString } from 'class-validator'

export class DisplayRequestHeadersDto {
  @IsString()
  id: string

  @IsString()
  'access-token': string

  @IsOptional()
  @IsString()
  'battery-voltage'?: string

  @IsOptional()
  @IsString()
  'fw-version'?: string

  @IsOptional()
  @IsNumberString()
  'refresh-rate'?: string

  @IsOptional()
  @IsString()
  rssi?: string

  @IsOptional()
  @IsString()
  'user-agent'?: string

  @IsOptional()
  @IsNumberString()
  height?: string

  @IsOptional()
  @IsNumberString()
  width?: string
}
