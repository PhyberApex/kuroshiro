import type { UploadFirmwareInput } from 'kuroshiro-shared'
import { Transform } from 'class-transformer'
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { trimmed } from '../../utils/trimmed.js'

/** The upload is a multipart form, so a list arrives as a JSON string. */
function parsedJson({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string')
    return value
  try {
    return JSON.parse(value)
  }
  catch {
    return value
  }
}

export class UploadFirmwareDto implements UploadFirmwareInput {
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  version: string

  @IsOptional()
  @IsString()
  label?: string

  @IsOptional()
  @Transform(parsedJson)
  @IsArray()
  @IsString({ each: true })
  compatibleModels?: string[]
}
