import type { JsonObject } from '../../utils/json'
import type { DataSourceLiteralValue, DataSourceMode } from '../entities/plugin-data-source.entity'
import { Type } from 'class-transformer'
import { IsArray, IsIn, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator'
import { DATA_SOURCE_MODES } from '../entities/plugin-data-source.entity'

export class PreviewSourceDto {
  @IsString()
  name: string

  @IsOptional()
  @IsIn(DATA_SOURCE_MODES)
  mode?: DataSourceMode

  @IsOptional()
  @IsString()
  url?: string

  @IsOptional()
  @IsString()
  method?: string

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>

  @IsOptional()
  @IsObject()
  body?: JsonObject

  @IsOptional()
  @IsString()
  transformJs?: string

  @IsOptional()
  literalValue?: DataSourceLiteralValue
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
