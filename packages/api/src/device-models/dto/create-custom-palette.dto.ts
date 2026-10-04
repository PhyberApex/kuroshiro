import type { CreateCustomPaletteInput, CustomPaletteFrameworkClass } from 'kuroshiro-shared'
import { Transform } from 'class-transformer'
import { ArrayNotEmpty, IsArray, IsIn, IsNotEmpty, IsString, Matches } from 'class-validator'
import { CUSTOM_PALETTE_FRAMEWORK_CLASSES, HEX_COLOR_PATTERN } from 'kuroshiro-shared'
import { trimmed } from '../../utils/trimmed.js'

export class CreateCustomPaletteDto implements CreateCustomPaletteInput {
  @Transform(trimmed)
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
