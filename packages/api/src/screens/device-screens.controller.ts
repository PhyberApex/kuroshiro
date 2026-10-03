import type { ScreenRead } from 'kuroshiro-shared'
import { Controller, Get, Param } from '@nestjs/common'
import { ScreenReadsService } from './screen-reads.service.js'

@Controller('devices/:deviceId/screens')
export class DeviceScreensController {
  constructor(private readonly screenReads: ScreenReadsService) {}

  @Get()
  async list(@Param('deviceId') deviceId: string): Promise<ScreenRead[]> {
    return this.screenReads.forDevice(deviceId)
  }
}
