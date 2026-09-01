import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DeviceModelsModule } from '../device-models/device-models.module.js'
import { Device } from '../devices/devices.entity.js'
import { ScreensController } from './screens.controller.js'
import { Screen } from './screens.entity.js'
import { ScreensService } from './screens.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([Screen, Device]), ConfigModule, DeviceModelsModule],
  controllers: [ScreensController],
  providers: [ScreensService],
  exports: [ScreensService],
})
export class ScreensModule {}
