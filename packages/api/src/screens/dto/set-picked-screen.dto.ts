import type { SetPickedScreenInput } from 'kuroshiro-shared'
import { IsUUID } from 'class-validator'

export class SetPickedScreenDto implements SetPickedScreenInput {
  @IsUUID()
  screenId: string
}
