import { ArrayUnique, IsArray, IsIn, IsOptional, IsString } from 'class-validator'
import { MASHUP_LAYOUT_IDS } from '../constants/layouts.js'

export class UpdateMashupDto {
  @IsOptional()
  @IsString()
  filename?: string

  @IsOptional()
  @IsString()
  @IsIn(MASHUP_LAYOUT_IDS)
  layout?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  pluginIds?: string[]
}
