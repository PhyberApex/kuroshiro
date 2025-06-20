import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DevicesController } from 'src/devices/devices.controller'
import { Device } from 'src/devices/devices.entity'
import { DevicesService } from 'src/devices/devices.service'
import { DisplayController } from 'src/devices/display.controller'
import { DeviceDisplayService } from 'src/devices/display.service'
import { SetupController } from 'src/devices/setup.controller'
import { DeviceSetupService } from 'src/devices/setup.service'
import { Screen } from 'src/screens/screens.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Device, Screen]), ConfigModule],
  controllers: [DevicesController, DisplayController, SetupController],
  providers: [DevicesService, DeviceDisplayService, DeviceSetupService],
  exports: [DevicesService],
})
export class DevicesModule {}
