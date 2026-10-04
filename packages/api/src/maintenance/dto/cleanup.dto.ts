import type { CleanupInput } from 'kuroshiro-shared'
import { IsArray, IsString } from 'class-validator'

export class CleanupDto implements CleanupInput {
  @IsArray()
  @IsString({ each: true })
  findingIds: string[]
}
