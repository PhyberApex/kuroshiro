import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Screen } from '../screens/screens.entity'
import { DevicesController } from './devices.controller'
import { Device } from './devices.entity'
import { DevicesService } from './devices.service'
import { DisplayController } from './display.controller'
import { DeviceDisplayService } from './display.service'
import { SetupController } from './setup.controller'
import { DeviceSetupService } from './setup.service'

@Module({
  imports: [TypeOrmModule.forFeature([Device, Screen]), ConfigModule],
  controllers: [DevicesController, DisplayController, SetupController],
  providers: [DevicesService, DeviceDisplayService, DeviceSetupService],
  exports: [DevicesService],
})
export class DevicesModule {}
