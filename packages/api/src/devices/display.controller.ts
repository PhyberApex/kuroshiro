import { Controller, Get } from '@nestjs/common'
import { OutsideAdminApi } from '../errors/outside-admin-api.decorator.js'
import { DeviceHeaders } from './device-headers.decorator.js'
import { Display } from './display.js'
import { DeviceDisplayService } from './display.service.js'
import { DisplayScreen } from './displayScreen.js'
import { DisplayRequestHeadersDto } from './dto/display-request-headers.dto.js'
import 'dotenv/config'

@Controller('')
@OutsideAdminApi()
export class DisplayController {
  constructor(
    private readonly deviceDisplayService: DeviceDisplayService,
  ) {}

  @Get('display')
  async getCurrentImage(@DeviceHeaders(DisplayRequestHeadersDto) headers: DisplayRequestHeadersDto): Promise<Display> {
    return this.deviceDisplayService.getCurrentImage(headers)
  }

  @Get('current_screen')
  async getCurrentImageWithoutProgressing(@DeviceHeaders(DisplayRequestHeadersDto) headers: DisplayRequestHeadersDto): Promise<DisplayScreen> {
    return this.deviceDisplayService.getCurrentImageWithoutProgressing(headers)
  }
}
