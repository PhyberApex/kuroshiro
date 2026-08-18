import { IsOptional, IsString } from 'class-validator'

export class SetupRequestHeadersDto {
  @IsString()
  id: string

  @IsOptional()
  @IsString()
  'fw-version'?: string

  @IsOptional()
  @IsString()
  model?: string
}
