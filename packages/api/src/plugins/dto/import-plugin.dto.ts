import type { ImportGithubPluginInput, ImportRecipeInput } from 'kuroshiro-shared'
import { IsOptional, IsString } from 'class-validator'

export class ImportGithubPluginDto implements ImportGithubPluginInput {
  @IsString()
  githubUrl: string

  @IsOptional()
  @IsString()
  deviceId?: string
}

export class ImportRecipeDto implements ImportRecipeInput {
  @IsString()
  recipe: string

  @IsOptional()
  @IsString()
  deviceId?: string
}
