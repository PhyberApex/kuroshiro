import { IsString } from 'class-validator'

export class CreateDeviceDto {
  @IsString()
  mac: string

  @IsString()
  name: string
}
