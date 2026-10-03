import type { PluginFieldInput } from 'kuroshiro-shared'
import { Type } from 'class-transformer'
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator'
// `@Type` reads design metadata as a DTO module is evaluated, and this is the first one the Plugin DTOs load.
import 'reflect-metadata'

class PluginFieldOptionDto {
  @IsString()
  label: string

  @IsString()
  value: string
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
}
