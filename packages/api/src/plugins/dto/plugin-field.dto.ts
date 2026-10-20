import type { PluginFieldAttributes, PluginFieldInput } from 'kuroshiro-shared'
import { Type } from 'class-transformer'
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'
// `@Type` reads design metadata as a DTO module is evaluated, and this is the first one the Plugin DTOs load.
import 'reflect-metadata'

class PluginFieldOptionDto {
  @IsString()
  label: string

  @IsString()
  value: string
}

class PluginFieldAttributesDto implements PluginFieldAttributes {
  @IsOptional()
  @IsString()
  placeholder?: string

  @IsOptional()
  @IsString()
  hint?: string

  @IsOptional()
  @IsString()
  group?: string

  @IsOptional()
  @IsNumber()
  min?: number

  @IsOptional()
  @IsNumber()
  max?: number

  @IsOptional()
  @IsNumber()
  step?: number

  @IsOptional()
  @IsInt()
  maxlength?: number

  @IsOptional()
  @IsInt()
  rows?: number

  @IsOptional()
  @IsBoolean()
  multiple?: boolean
}

export class PluginFieldDto implements PluginFieldInput {
  @IsString()
  keyname: string

  @IsOptional()
  @IsString()
  fieldType?: string

  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  defaultValue?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PluginFieldOptionDto)
  options?: PluginFieldOptionDto[] | null

  @IsOptional()
  @IsBoolean()
  required?: boolean

  @IsOptional()
  @IsInt()
  order?: number

  @IsOptional()
  @ValidateNested()
  @Type(() => PluginFieldAttributesDto)
  attributes?: PluginFieldAttributesDto
}
