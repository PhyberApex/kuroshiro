import type { CustomPaletteFrameworkClass } from '../entities/palette.entity.js'
import { ArrayNotEmpty, IsArray, IsIn, IsNotEmpty, IsString, Matches } from 'class-validator'
import { CUSTOM_PALETTE_FRAMEWORK_CLASSES } from '../entities/palette.entity.js'
import { HEX_COLOR_PATTERN } from '../trmnl-payloads.js'

export class CreateCustomPaletteDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsIn(CUSTOM_PALETTE_FRAMEWORK_CLASSES)
  frameworkClass: CustomPaletteFrameworkClass

  @IsArray()
  @ArrayNotEmpty()
  @Matches(HEX_COLOR_PATTERN, { each: true, message: 'colors must each be a #RRGGBB hex value' })
  colors: string[]
}
