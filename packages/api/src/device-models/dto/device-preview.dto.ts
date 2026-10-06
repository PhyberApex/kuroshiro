import type { DevicePreviewInput } from 'kuroshiro-shared'
import { IsNotEmpty, IsString } from 'class-validator'

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
}
