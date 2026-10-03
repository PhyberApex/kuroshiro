import type { DisplayRequestHeadersDto } from './dto/display-request-headers.dto.js'
import { Controller, Get, Headers } from '@nestjs/common'
import { OutsideAdminApi } from '../errors/outside-admin-api.decorator.js'
import { Display } from './display.js'
import { DeviceDisplayService } from './display.service.js'
import { DisplayScreen } from './displayScreen.js'
import 'dotenv/config'

@Controller('')
@OutsideAdminApi()
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
