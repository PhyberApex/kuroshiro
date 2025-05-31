import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class CreateScreenDto {
  @IsString()
  filename: string

  @IsOptional()
  @IsString()
  externalLink?: string

  @IsString()
  deviceId: string

  @IsOptional()
  @IsBoolean()
  fetchManual: boolean
}
