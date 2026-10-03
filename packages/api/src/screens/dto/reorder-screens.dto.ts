import type { ReorderScreensInput } from 'kuroshiro-shared'
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator'

export class ReorderScreensDto implements ReorderScreensInput {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  screenIds: string[]
}
