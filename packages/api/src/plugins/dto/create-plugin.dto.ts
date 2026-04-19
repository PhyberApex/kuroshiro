import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator'

export class CreatePluginDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  kind?: string

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
  dataSource?: any

  @IsOptional()
  templates?: any[]

  @IsOptional()
  fields?: any[]
}
