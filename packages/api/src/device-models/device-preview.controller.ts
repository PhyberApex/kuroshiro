import type { Response } from 'express'
import { Body, Controller, Post, Res } from '@nestjs/common'
import { DEVICE_PREVIEW_SIGNAL_HEADER } from 'kuroshiro-shared'
import { DevicePreviewService } from './device-preview.service.js'
import { DevicePreviewDto } from './dto/device-preview.dto.js'

@Controller('device-preview')
export class DevicePreviewController {
  constructor(private readonly devicePreview: DevicePreviewService) {}

  @Post()
  async render(@Body() body: DevicePreviewDto, @Res() res: Response): Promise<void> {
    const { buffer, signal } = await this.devicePreview.render(body)
    res.setHeader('Content-Type', 'image/png')
    res.setHeader(DEVICE_PREVIEW_SIGNAL_HEADER, signal)
    res.send(buffer)
  }
}
