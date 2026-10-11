import type { DeviceDetail } from 'kuroshiro-shared'
import { Controller, Delete, HttpCode, HttpStatus, Param, Put, UploadedFile, UseInterceptors } from '@nestjs/common'
import { LimitedFileInterceptor } from '../uploads/limited-file-interceptor.js'
import { UPLOAD_LIMITS } from '../uploads/upload-limits.js'
import { DeviceReadsService } from './device-reads.service.js'
import { DeviceSleepImageService } from './device-sleep-image.service.js'

@Controller('devices/:deviceId/sleep-image')
export class DeviceSleepImageController {
  constructor(
    private readonly deviceSleepImage: DeviceSleepImageService,
    private readonly deviceReads: DeviceReadsService,
  ) {}

  @Put()
  @UseInterceptors(LimitedFileInterceptor('file', UPLOAD_LIMITS.imageUploadBytes))
  async upload(@Param('deviceId') deviceId: string, @UploadedFile() file?: Express.Multer.File): Promise<DeviceDetail> {
    await this.deviceSleepImage.upload(deviceId, file)
    return this.deviceReads.detail(deviceId)
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async remove(@Param('deviceId') deviceId: string): Promise<DeviceDetail> {
    await this.deviceSleepImage.remove(deviceId)
    return this.deviceReads.detail(deviceId)
  }
}
