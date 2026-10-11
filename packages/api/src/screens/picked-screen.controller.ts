import type { ScreenRead } from 'kuroshiro-shared'
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Put } from '@nestjs/common'
import { SetPickedScreenDto } from './dto/set-picked-screen.dto.js'
import { PickedScreenService } from './picked-screen.service.js'
import { ScreenReadsService } from './screen-reads.service.js'

/** "Show next" / "Back to Order"; every write answers the Device's Screens, whose Up next it has just moved. */
@Controller('devices/:deviceId/picked-screen')
export class PickedScreenController {
  constructor(private readonly pickedScreen: PickedScreenService, private readonly screenReads: ScreenReadsService) {}

  @Put()
  async set(@Param('deviceId') deviceId: string, @Body() dto: SetPickedScreenDto): Promise<ScreenRead[]> {
    await this.pickedScreen.set(deviceId, dto.screenId)
    return this.screenReads.forDevice(deviceId)
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async clear(@Param('deviceId') deviceId: string): Promise<ScreenRead[]> {
    await this.pickedScreen.clear(deviceId)
    return this.screenReads.forDevice(deviceId)
  }
}
