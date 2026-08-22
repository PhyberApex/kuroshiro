import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator'

export class UpdateDeviceAssignmentDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number
}
