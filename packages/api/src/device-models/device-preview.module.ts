import { Module } from '@nestjs/common'
import { DeviceModelsModule } from './device-models.module.js'
import { DevicePreviewController } from './device-preview.controller.js'
import { DevicePreviewService } from './device-preview.service.js'

@Module({
  imports: [DeviceModelsModule],
  controllers: [DevicePreviewController],
  providers: [DevicePreviewService],
})
export class DevicePreviewModule {}
