import type { ScreenRead } from 'kuroshiro-shared'
import { Body, Controller, Get, Param, Put } from '@nestjs/common'
import { ReorderScreensDto } from './dto/reorder-screens.dto.js'
import { ScreenReadsService } from './screen-reads.service.js'
import { ScreensService } from './screens.service.js'

@Controller('devices/:deviceId/screens')
export class DeviceScreensController {
  constructor(private readonly screenReads: ScreenReadsService, private readonly screensService: ScreensService) {}

  @Get()
  async list(@Param('deviceId') deviceId: string): Promise<ScreenRead[]> {
    return this.screenReads.forDevice(deviceId)
  }

  @Put('order')
  async reorder(@Param('deviceId') deviceId: string, @Body() body: ReorderScreensDto): Promise<ScreenRead[]> {
    await this.screensService.reorder(deviceId, body.screenIds)
    return this.screenReads.forDevice(deviceId)
  }
}
