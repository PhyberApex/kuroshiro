import type { DisplayRequestHeadersDto } from './dto/display-request-headers.dto.js'
import { Controller, Get, Headers } from '@nestjs/common'
import { DeviceFacing } from '../errors/device-facing.decorator.js'
import { Display } from './display.js'
import { DeviceDisplayService } from './display.service.js'
import { DisplayScreen } from './displayScreen.js'
import 'dotenv/config'

@Controller('')
@DeviceFacing()
export class DisplayController {
  constructor(
    private readonly deviceDisplayService: DeviceDisplayService,
  ) {}

  @Get('display')
  async getCurrentImage(@Headers() headers: DisplayRequestHeadersDto): Promise<Display> {
    return this.deviceDisplayService.getCurrentImage(headers)
  }

  @Get('current_screen')
  async getCurrentImageWithoutProgressing(@Headers() headers: DisplayRequestHeadersDto): Promise<DisplayScreen> {
    return this.deviceDisplayService.getCurrentImageWithoutProgressing(headers)
  }
}
