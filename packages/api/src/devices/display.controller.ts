import type { DisplayRequestHeadersDto } from './dto/display-request-headers.dto.js'
import { Controller, Get, Headers, UsePipes, ValidationPipe } from '@nestjs/common'
import { Display } from './display.js'
import { DeviceDisplayService } from './display.service.js'
import { DisplayScreen } from './displayScreen.js'
import 'dotenv/config'

@Controller('')
export class DisplayController {
  constructor(
    private readonly deviceDisplayService: DeviceDisplayService,
  ) {}

  @Get('display')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  async getCurrentImage(@Headers() headers: DisplayRequestHeadersDto): Promise<Display> {
    return this.deviceDisplayService.getCurrentImage(headers)
  }

  @Get('current_screen')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  async getCurrentImageWithoutProgressing(@Headers() headers: DisplayRequestHeadersDto): Promise<DisplayScreen> {
    return this.deviceDisplayService.getCurrentImageWithoutProgressing(headers)
  }
}
