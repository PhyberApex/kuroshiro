import type { MergeStrategy, PluginKind } from '../entities/plugin.entity'
import { Type } from 'class-transformer'
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator'
import { MERGE_STRATEGIES, PLUGIN_KINDS } from '../entities/plugin.entity'
import { PluginDataSourceDto } from './plugin-data-source.dto'
import { PluginFieldDto } from './plugin-field.dto'
import { PluginTemplateDto } from './plugin-template.dto'

export class UpdatePluginDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsIn(PLUGIN_KINDS)
  kind?: PluginKind

  @IsOptional()
  @IsInt()
  refreshInterval?: number

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsInt()
  order?: number

  @IsOptional()
  @IsString()
  webhookToken?: string

  @IsOptional()
  @IsIn(MERGE_STRATEGIES)
  mergeStrategy?: MergeStrategy

  @IsOptional()
  @IsInt()
  @Min(1)
  streamLimit?: number

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PluginDataSourceDto)
  dataSources?: PluginDataSourceDto[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PluginTemplateDto)
  templates?: PluginTemplateDto[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PluginFieldDto)
  fields?: PluginFieldDto[]
}
