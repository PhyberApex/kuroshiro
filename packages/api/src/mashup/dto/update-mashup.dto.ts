import { ArrayUnique, IsArray, IsIn, IsOptional, IsString } from 'class-validator'

export class UpdateMashupDto {
  @IsOptional()
  @IsString()
  filename?: string

  @IsOptional()
  @IsString()
  @IsIn(['1Lx1R', '1Tx1B', '1Lx2R', '2Lx1R', '2Tx1B', '1Tx2B', '2x2'])
  layout?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  pluginIds?: string[]
}
