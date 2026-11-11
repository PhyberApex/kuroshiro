import { IsOptional, IsString, Matches } from 'class-validator'
import { MAC_ADDRESS_PATTERN } from 'kuroshiro-shared'

export class SetupRequestHeadersDto {
  /**
   * The MAC the Device announces itself with, in any letter case: TRMNL firmware
   * sends it upper-cased, BYOD clients often lower-cased. Anything else is refused,
   * so `/api/setup` cannot be used to fill the Device list with made-up Devices.
   */
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
