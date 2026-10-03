import type { CreateScreenInput } from 'kuroshiro-shared'
import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsNotEmpty, IsString, IsUrl, IsUUID, ValidateIf } from 'class-validator'
import { CREATABLE_SCREEN_KINDS } from 'kuroshiro-shared'
import { trimmed } from '../../utils/trimmed.js'

const BOOLEAN_BY_FORM_VALUE: Record<string, boolean> = { true: true, false: false }

/**
 * The fields of every kind on one class, each validated only for the kind it
 * belongs to; a field of another kind is accepted and not stored. Sent as JSON
 * or, with a file, as `multipart/form-data`, where every value is a string.
 */
export class CreateScreenDto implements Pick<CreateScreenInput, 'deviceId' | 'kind' | 'name'> {
  @IsUUID()
  deviceId: string

  @IsIn(CREATABLE_SCREEN_KINDS)
  kind: CreateScreenInput['kind']

  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  name: string

  @ValidateIf((input: CreateScreenDto) => input.kind === 'external')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  url?: string

  @ValidateIf((input: CreateScreenDto) => input.kind === 'external')
  @Transform(({ value }) => typeof value === 'string' ? BOOLEAN_BY_FORM_VALUE[value] ?? value : value)
  @IsBoolean()
  fetchManual?: boolean

  @ValidateIf((input: CreateScreenDto) => input.kind === 'html')
  @IsString()
  @IsNotEmpty()
  html?: string
}
