import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator'

export class AssignPluginToDeviceDto {
  @IsString()
  deviceId: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsInt()
  order?: number
}
