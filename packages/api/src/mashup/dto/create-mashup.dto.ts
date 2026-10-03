import type { CreateMashupInput, MashupLayout } from 'kuroshiro-shared'
import { Transform } from 'class-transformer'
import { ArrayUnique, IsArray, IsIn, IsNotEmpty, IsString, IsUUID } from 'class-validator'
import { trimmed } from '../../utils/trimmed.js'
import { MASHUP_LAYOUT_IDS } from '../constants/layouts.js'

export class CreateMashupDto implements CreateMashupInput {
  @IsUUID()
  deviceId: string

  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  name: string

  @IsIn(MASHUP_LAYOUT_IDS)
  layout: MashupLayout

  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayUnique()
  pluginIds: string[]
}
