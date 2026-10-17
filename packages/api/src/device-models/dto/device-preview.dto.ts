import type { DevicePreviewInput } from 'kuroshiro-shared'
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator'

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

  @ValidateIf((input: DevicePreviewDto) => input.dither !== undefined)
  @IsBoolean()
  dither?: boolean
}
