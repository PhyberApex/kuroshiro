import { ArrayNotEmpty, IsArray, IsString } from 'class-validator'

export class ReorderScreensDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  screenIds: string[]
}
