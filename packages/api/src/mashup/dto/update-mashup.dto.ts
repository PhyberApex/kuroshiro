import type { MashupLayout, UpdateMashupInput } from 'kuroshiro-shared'
import { ArrayUnique, IsArray, IsIn, IsOptional, IsUUID } from 'class-validator'
import { MASHUP_LAYOUT_IDS } from '../constants/layouts.js'

export class UpdateMashupDto implements UpdateMashupInput {
  @IsOptional()
  @IsIn(MASHUP_LAYOUT_IDS)
  layout?: MashupLayout

  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayUnique()
  pluginIds: string[]
}
