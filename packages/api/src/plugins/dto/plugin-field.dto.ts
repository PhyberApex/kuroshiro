import { Type } from 'class-transformer'
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator'

class PluginFieldOptionDto {
  @IsString()
  label: string

  @IsString()
  value: string
}

export class PluginFieldDto {
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
