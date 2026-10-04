import type { CustomPaletteFrameworkClass, UpdateCustomPaletteInput } from 'kuroshiro-shared'
import { Transform } from 'class-transformer'
import { ArrayNotEmpty, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator'
import { CUSTOM_PALETTE_FRAMEWORK_CLASSES, HEX_COLOR_PATTERN } from 'kuroshiro-shared'
import { trimmed } from '../../utils/trimmed.js'

export class UpdateCustomPaletteDto implements UpdateCustomPaletteInput {
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  name?: string

  @IsOptional()
  @IsIn(CUSTOM_PALETTE_FRAMEWORK_CLASSES)
  frameworkClass?: CustomPaletteFrameworkClass

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @Matches(HEX_COLOR_PATTERN, { each: true, message: 'colors must each be a #RRGGBB hex value' })
  colors?: string[]
}
