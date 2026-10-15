import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Plugin } from '../plugins/entities/plugin.entity.js'
import { DeviceModelsModule } from './device-models.module.js'
import { DevicePreviewController } from './device-preview.controller.js'
import { DevicePreviewService } from './device-preview.service.js'

@Module({
  imports: [DeviceModelsModule, TypeOrmModule.forFeature([Plugin])],
  controllers: [DevicePreviewController],
  providers: [DevicePreviewService],
})
export class DevicePreviewModule {}
