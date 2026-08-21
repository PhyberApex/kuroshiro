import type { MergeStrategy, PluginKind } from '../entities/plugin.entity'
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator'
import { MERGE_STRATEGIES, PLUGIN_KINDS } from '../entities/plugin.entity'

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
  dataSource?: any

  @IsOptional()
  templates?: any[]
}
