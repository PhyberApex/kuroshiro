import { IsArray, IsBoolean, IsOptional } from 'class-validator'

export class CleanupDto {
  @IsArray()
  @IsOptional()
  orphanedFiles?: string[]

  @IsArray()
  @IsOptional()
  orphanedDirs?: string[]

  @IsArray()
  @IsOptional()
  brokenScreens?: string[]

  @IsArray()
  @IsOptional()
  tempFiles?: string[]

  @IsArray()
  @IsOptional()
  oldUploads?: string[]

  @IsBoolean()
  @IsOptional()
  dryRun?: boolean
}
