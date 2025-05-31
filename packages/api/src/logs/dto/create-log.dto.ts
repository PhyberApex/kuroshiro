import { IsObject } from 'class-validator'

export class CreateLogDto {
  @IsObject()
  log: Record<string, any>
}
