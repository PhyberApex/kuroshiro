import { IsBoolean, IsOptional } from 'class-validator'

export class RetentionRunDto {
  @IsBoolean()
  @IsOptional()
  dryRun?: boolean
}
