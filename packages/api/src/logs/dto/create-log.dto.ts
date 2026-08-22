import type { JsonObject } from '../../utils/json'
import { IsObject } from 'class-validator'

export class CreateLogDto {
  @IsObject()
  log: {
    logs_array: Array<{
      log_id: number
    } & JsonObject>
  }
}
