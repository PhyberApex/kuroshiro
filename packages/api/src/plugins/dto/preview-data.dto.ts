import type { DataSourceLiteralValue, DataSourceMethod, DataSourceMode, PreviewDataInput } from 'kuroshiro-shared'
import type { JsonObject } from '../../utils/json.js'
import { Type } from 'class-transformer'
import { IsArray, IsDefined, IsIn, IsObject, IsOptional, IsString, IsUUID, ValidateIf, ValidateNested } from 'class-validator'
import { DATA_SOURCE_METHODS, DATA_SOURCE_MODES } from 'kuroshiro-shared'

/**
 * A Data Source as the form holds it, which may be half typed: only the types
 * are checked, and one that cannot be fetched answers its error marker
 * instead of refusing the whole preview.
 */
class PreviewDataSourceDto {
  @IsOptional()
  @IsString()
  id?: string

  @IsString()
  name: string

  @IsIn(DATA_SOURCE_MODES)
  mode: DataSourceMode

  @IsOptional()
  @IsIn(DATA_SOURCE_METHODS)
  method?: DataSourceMethod

  @IsOptional()
  @IsString()
  url?: string

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
  literalValue?: DataSourceLiteralValue
}

export class PreviewDataDto implements PreviewDataInput {
  @IsDefined()
  @ValidateIf((_dto, value) => value !== null)
  @IsUUID()
  deviceId: string | null

  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreviewDataSourceDto)
  dataSources?: PreviewDataSourceDto[]

  @IsOptional()
  @IsObject()
  fieldValues?: Record<string, string | null>
}
