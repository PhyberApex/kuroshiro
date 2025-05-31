import { IsString } from 'class-validator'

export class SetupRequestHeadersDto {
  @IsString()
  id: string
}
