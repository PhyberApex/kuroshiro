import type { DevicePreviewInput } from 'kuroshiro-shared'
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator'

export class DevicePreviewDto implements DevicePreviewInput {
  @IsString()
  @IsNotEmpty()
  html: string

  @IsString()
  @IsNotEmpty()
  deviceModelName: string

  @IsString()
  @IsNotEmpty()
  paletteId: string

  @IsOptional()
  @IsUUID()
  pluginId?: string

  @IsOptional()
  @IsBoolean()
  dither?: boolean
}
