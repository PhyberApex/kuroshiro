import type { JsonObject } from '../../utils/json'
import { Type } from 'class-transformer'
import { IsArray, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator'

export class PreviewSourceDto {
  @IsString()
  name: string

  @IsString()
  url: string

  @IsString()
  method: string

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>

  @IsOptional()
  @IsObject()
  body?: JsonObject

  @IsOptional()
  @IsString()
  transformJs?: string
}

export class PreviewPluginDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreviewSourceDto)
  sources: PreviewSourceDto[]

  @IsOptional()
  @IsString()
  template?: string

  @IsOptional()
  @IsObject()
  fieldValues?: Record<string, string>
}
