import type { CreateDeviceInput } from 'kuroshiro-shared'
import { Transform } from 'class-transformer'
import { IsNotEmpty, IsString, Matches } from 'class-validator'
import { MAC_ADDRESS_PATTERN } from 'kuroshiro-shared'
import { trimmed } from '../../utils/trimmed.js'

export class CreateDeviceDto implements CreateDeviceInput {
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  name: string

  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @Matches(MAC_ADDRESS_PATTERN)
  mac: string
}
