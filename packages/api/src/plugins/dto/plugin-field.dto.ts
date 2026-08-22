import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator'

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
  @IsBoolean()
  required?: boolean

  @IsOptional()
  @IsInt()
  order?: number
}
