import type { ValidationArguments, ValidationOptions, ValidatorConstraintInterface } from 'class-validator'
import type { MergeStrategy, PluginKind } from '../entities/plugin.entity.js'
import { Type } from 'class-transformer'
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, registerDecorator, ValidateNested, ValidatorConstraint } from 'class-validator'
import { MERGE_STRATEGIES, PLUGIN_KINDS } from '../entities/plugin.entity.js'
import { pluginKindFieldViolation } from '../plugin-kind-fields.js'
import { PluginDataSourceDto } from './plugin-data-source.dto.js'
import { PluginFieldDto } from './plugin-field.dto.js'
import { PluginTemplateDto } from './plugin-template.dto.js'

@ValidatorConstraint({ name: 'pluginKindFields' })
class PluginKindFieldsConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    return pluginKindFieldViolation(this.fieldsOf(args)) === null
  }

  defaultMessage(args: ValidationArguments): string {
    return pluginKindFieldViolation(this.fieldsOf(args)) ?? ''
  }

  private fieldsOf(args: ValidationArguments) {
    const dto = args.object as CreatePluginDto
    return {
      kind: dto.kind,
      dataSources: dto.dataSources,
      webhookToken: dto.webhookToken,
      mergeStrategy: dto.mergeStrategy,
      streamLimit: dto.streamLimit,
    }
  }
}

function MatchesPluginKind(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: PluginKindFieldsConstraint,
    })
  }
}

export class CreatePluginDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsIn(PLUGIN_KINDS)
  @MatchesPluginKind()
  kind: PluginKind = 'Poll'

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
  @IsString()
  sourceRecipeId?: string

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
