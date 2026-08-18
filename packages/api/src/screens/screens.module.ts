import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DeviceModelsModule } from '../device-models/device-models.module'
import { Device } from '../devices/devices.entity'
import { ScreensController } from './screens.controller'
import { Screen } from './screens.entity'
import { ScreensService } from './screens.service'

@Module({
  imports: [TypeOrmModule.forFeature([Screen, Device]), ConfigModule, DeviceModelsModule],
  controllers: [ScreensController],
  providers: [ScreensService],
})
export class ScreensModule {}
