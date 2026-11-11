import { IsOptional, IsString, Matches } from 'class-validator'
import { MAC_ADDRESS_PATTERN } from 'kuroshiro-shared'

/**
 * The headers a Device announces itself with on `/api/setup`. Its `ID` must be a
 * MAC address in any letter case: TRMNL firmware sends it upper-cased, BYOD clients
 * often lower-cased. Anything else is refused, so setup cannot fill the Device list
 * with made-up Devices.
 */
export class SetupRequestHeadersDto {
  @IsString()
  @Matches(MAC_ADDRESS_PATTERN, { message: '$property must be a MAC address like AA:BB:CC:DD:EE:FF' })
  id: string

  @IsOptional()
  @IsString()
  'fw-version'?: string

  @IsOptional()
  @IsString()
  model?: string
}
