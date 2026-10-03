import { ArrayUnique, IsArray, IsIn, IsString } from 'class-validator'
import { MASHUP_LAYOUT_IDS } from '../constants/layouts.js'

export class CreateMashupDto {
  @IsString()
  deviceId: string

  @IsString()
  filename: string

  @IsString()
  @IsIn(MASHUP_LAYOUT_IDS)
  layout: string

  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  pluginIds: string[]
}
