import { IsOptional, IsString } from 'class-validator'

export class PluginTemplateDto {
  @IsOptional()
  @IsString()
  layout?: string

  @IsString()
  liquidMarkup: string
}
