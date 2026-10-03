import type { ReorderScreensInput } from 'kuroshiro-shared'
import { IsArray, IsString } from 'class-validator'

export class ReorderScreensDto implements ReorderScreensInput {
  @IsArray()
  @IsString({ each: true })
  screenIds: string[]
}
