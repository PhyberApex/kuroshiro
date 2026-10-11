import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DeviceModelsModule } from '../device-models/device-models.module.js'
import { DeviceSensorsModule } from '../device-sensors/device-sensors.module.js'
import { Screen } from '../screens/screens.entity.js'
import { DeviceReadsService } from './device-reads.service.js'
import { DeviceSleepImageController } from './device-sleep-image.controller.js'
import { DeviceSleepImageService } from './device-sleep-image.service.js'
import { Device } from './devices.entity.js'

/**
 * Its own module, apart from `DevicesModule`, so a Device Model or Palette
 * change (`DevicesModule`) and a custom Palette's own edit
 * (`CustomPalettesModule`) can both reconvert the sleep image without
 * importing each other's heavier module.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Device, Screen]), ConfigModule, DeviceModelsModule, DeviceSensorsModule],
  controllers: [DeviceSleepImageController],
  providers: [DeviceSleepImageService, DeviceReadsService],
  exports: [DeviceSleepImageService],
})
export class DeviceSleepImageModule {}
