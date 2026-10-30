import { IsOptional, IsString } from 'class-validator'

/**
 * The two headers a Device sends to prove who it is: its MAC and the API key it
 * got from `/api/setup`. A missing key is no malformed request but a failed
 * check, so it is left to `authenticateDevice` to answer 401.
 */
export class DeviceCredentialsHeadersDto {
  @IsString()
  id: string

  @IsOptional()
  @IsString()
  'access-token'?: string
}
