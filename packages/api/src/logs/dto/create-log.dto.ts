import { IsObject } from 'class-validator'

export class CreateLogDto {
  @IsObject()
  log: {
    logs_array: Array<{
      log_id: number
    } & Record<string, any>>
  }
}
