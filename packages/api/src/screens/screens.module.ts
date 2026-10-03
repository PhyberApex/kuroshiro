import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Alert } from '../alerts/entities/alert.entity.js'
import { DeviceModelsModule } from '../device-models/device-models.module.js'
import { Device } from '../devices/devices.entity.js'
import { DevicePlugin } from '../plugins/entities/device-plugin.entity.js'
import { PluginsModule } from '../plugins/plugins.module.js'
import { DeviceScreensController } from './device-screens.controller.js'
import { ScreenReadsService } from './screen-reads.service.js'
import { ScreensController } from './screens.controller.js'
import { Screen } from './screens.entity.js'
import { ScreensService } from './screens.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([Screen, Device, DevicePlugin, Alert]), ConfigModule, DeviceModelsModule, PluginsModule],
  controllers: [ScreensController, DeviceScreensController],
  providers: [ScreensService, ScreenReadsService],
  exports: [ScreensService],
})
export class ScreensModule {}
