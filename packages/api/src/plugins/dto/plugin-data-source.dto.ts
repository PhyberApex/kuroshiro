import type { JsonObject } from '../../utils/json'
import { IsInt, IsObject, IsOptional, IsString } from 'class-validator'

export class PluginDataSourceDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  method?: string

  @IsString()
  url: string

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>

  @IsOptional()
  @IsObject()
  body?: JsonObject

  @IsOptional()
  @IsString()
  transformJs?: string | null

  @IsOptional()
  @IsInt()
  order?: number
}
