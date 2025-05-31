import { IsNumber, IsOptional, IsString } from 'class-validator'

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
  @IsNumber()
  'refresh-rate'?: number

  @IsOptional()
  @IsString()
  rssi?: string

  @IsOptional()
  @IsString()
  'user-agent'?: string

  @IsOptional()
  @IsNumber()
  height?: number

  @IsOptional()
  @IsNumber()
  width?: number
}
