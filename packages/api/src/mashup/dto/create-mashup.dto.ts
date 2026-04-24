import { ArrayUnique, IsArray, IsIn, IsString } from 'class-validator'

export class CreateMashupDto {
  @IsString()
  deviceId: string

  @IsString()
  filename: string

  @IsString()
  @IsIn(['1Lx1R', '1Tx1B', '1Lx2R', '2Lx1R', '2Tx1B', '1Tx2B', '2x2'])
  layout: string

  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  pluginIds: string[]
}
