import type { CreatePollPluginInput, CreateWebhookPluginInput, MergeStrategy, PluginKind } from 'kuroshiro-shared'
import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateIf } from 'class-validator'
import { MERGE_STRATEGIES, PLUGIN_KINDS } from 'kuroshiro-shared'

/**
 * `CreatePluginInput` as one class: what only a Webhook-kind Plugin carries is optional here, and
 * `PluginsService.build` refuses it on the Plugin Kind it does not belong to.
 */
export class CreatePluginDto implements Omit<CreatePollPluginInput, 'kind'>, Partial<Omit<CreateWebhookPluginInput, 'kind'>> {
  @IsIn(PLUGIN_KINDS)
  kind: PluginKind

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  name: string

  @IsOptional()
  @IsIn(MERGE_STRATEGIES)
  mergeStrategy?: MergeStrategy

  @IsOptional()
  @IsInt()
  @Min(1)
  streamLimit?: number

  @ValidateIf((input: CreatePluginDto) => input.dither !== undefined)
  @IsBoolean()
  dither?: boolean

  @ValidateIf((input: CreatePluginDto) => input.noScreenPadding !== undefined)
  @IsBoolean()
  noScreenPadding?: boolean

  @ValidateIf((input: CreatePluginDto) => input.darkMode !== undefined)
  @IsBoolean()
  darkMode?: boolean

  @IsOptional()
  @IsString()
  deviceId?: string
}
