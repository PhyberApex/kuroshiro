import type { UpdateScreenInput } from 'kuroshiro-shared'
import { Transform } from 'class-transformer'
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator'
import { trimmed } from '../../utils/trimmed.js'

export class UpdateScreenDto implements UpdateScreenInput {
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  name?: string

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  url?: string

  @IsOptional()
  @IsBoolean()
  fetchManual?: boolean

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  html?: string
}
