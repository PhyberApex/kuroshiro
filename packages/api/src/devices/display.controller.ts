import type { DisplayRequestHeadersDto } from './dto/display-request-headers.dto'
import { Controller, Get, Headers, UsePipes, ValidationPipe } from '@nestjs/common'
import { Display } from './display'
import { DeviceDisplayService } from './display.service'
import { DisplayScreen } from './displayScreen'
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
