import type { DataSourceInput, DataSourceMethod, TemplateSize, UpdatePluginInput } from 'kuroshiro-shared'
import { Transform, Type } from 'class-transformer'
import { IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, Matches, Max, Min, ValidateIf, ValidateNested } from 'class-validator'
import { FRAMEWORK_VERSION_PATTERN, REFRESH_INTERVAL_BOUNDS, TEMPLATE_SIZES } from 'kuroshiro-shared'
import { PluginDataSourceDto } from './plugin-data-source.dto.js'
import { PluginFieldDto } from './plugin-field.dto.js'

function isSent(_dto: object, value: unknown): boolean {
  return value !== undefined
}

export class UpdateDataSourceDto extends PluginDataSourceDto implements DataSourceInput {
  declare method?: DataSourceMethod

  @IsOptional()
  @IsUUID()
  id?: string
}

export class UpdateTemplateDto {
  @IsIn(TEMPLATE_SIZES)
  size: TemplateSize

  @IsString()
  liquidMarkup: string
}

/**
 * What the Plugin page's form holds. `kind`, `mergeStrategy`, `streamLimit`
 * and `webhookToken` are fixed when a Plugin is created, so they are not
 * declared and the validation pipe refuses them.
 */
export class UpdatePluginDto implements UpdatePluginInput {
  @ValidateIf(isSent)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  name?: string

  @IsOptional()
  @IsString()
  description?: string | null

  @ValidateIf(isSent)
  @IsInt()
  @Min(REFRESH_INTERVAL_BOUNDS.min)
  @Max(REFRESH_INTERVAL_BOUNDS.max)
  refreshInterval?: number

  @IsOptional()
  @Transform(({ value }) => value === '' ? null : value)
  @Matches(FRAMEWORK_VERSION_PATTERN, { message: 'frameworkVersion must be an exact version like 3.4.0' })
  frameworkVersion?: string | null

  @ValidateIf(isSent)
  @IsBoolean()
  dither?: boolean

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateTemplateDto)
  templates?: UpdateTemplateDto[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateDataSourceDto)
  dataSources?: UpdateDataSourceDto[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PluginFieldDto)
  fields?: PluginFieldDto[]

  @IsOptional()
  @IsObject()
  fieldValues?: Record<string, string | null>
}
