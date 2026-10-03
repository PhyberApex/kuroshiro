import type { AssignPluginInput } from 'kuroshiro-shared'
import { IsUUID } from 'class-validator'

export class AssignPluginToDeviceDto implements AssignPluginInput {
  @IsUUID()
  deviceId: string
}
