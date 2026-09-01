import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DeviceModelsModule } from '../device-models/device-models.module.js'
import { DeviceSensorsModule } from '../device-sensors/device-sensors.module.js'
import { FirmwareModule } from '../firmware/firmware.module.js'
import { LogEntry } from '../logs/logs.entity.js'
import { PluginsModule } from '../plugins/plugins.module.js'
import { Screen } from '../screens/screens.entity.js'
import { ScreensModule } from '../screens/screens.module.js'
import { DevicesController } from './devices.controller.js'
import { Device } from './devices.entity.js'
import { DevicesService } from './devices.service.js'
import { DisplayController } from './display.controller.js'
import { DeviceDisplayService } from './display.service.js'
import { SetupController } from './setup.controller.js'
import { DeviceSetupService } from './setup.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([Device, Screen, LogEntry]), ConfigModule, PluginsModule, DeviceModelsModule, DeviceSensorsModule, FirmwareModule, ScreensModule],
  controllers: [DevicesController, DisplayController, SetupController],
  providers: [DevicesService, DeviceDisplayService, DeviceSetupService],
  exports: [DevicesService],
})
export class DevicesModule {}
