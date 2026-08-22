import type { ValidationArguments, ValidationOptions, ValidatorConstraintInterface } from 'class-validator'
import type { JsonObject } from '../../utils/json'
import type { DataSourceLiteralValue, DataSourceMode } from '../entities/plugin-data-source.entity'
import { IsIn, IsInt, IsObject, IsOptional, IsString, registerDecorator, ValidatorConstraint } from 'class-validator'
import { DATA_SOURCE_MODES } from '../entities/plugin-data-source.entity'
import { dataSourceModeViolation } from '../plugin-data-source-mode'

@ValidatorConstraint({ name: 'dataSourceModeFields' })
class DataSourceModeFieldsConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    return dataSourceModeViolation(this.fieldsOf(args)) === null
  }

  defaultMessage(args: ValidationArguments): string {
    return dataSourceModeViolation(this.fieldsOf(args)) ?? ''
  }

  private fieldsOf(args: ValidationArguments) {
    const dto = args.object as PluginDataSourceDto
    return {
      mode: dto.mode,
      method: dto.method,
      url: dto.url,
      headers: dto.headers,
      body: dto.body,
      transformJs: dto.transformJs,
      literalValue: dto.literalValue,
    }
  }
}

function MatchesDataSourceMode(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: DataSourceModeFieldsConstraint,
    })
  }
}

export class PluginDataSourceDto {
  @IsString()
  name: string

  @IsIn(DATA_SOURCE_MODES)
  @MatchesDataSourceMode()
  mode: DataSourceMode = 'fetch'

  @IsOptional()
  @IsString()
  method?: string

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

  @IsOptional()
  @IsInt()
  order?: number
}
