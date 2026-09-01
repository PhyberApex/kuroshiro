import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Device } from '../devices/devices.entity.js'
import { Screen } from '../screens/screens.entity.js'
import { MaintenanceController } from './maintenance.controller.js'
import { MaintenanceService } from './maintenance.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([Device, Screen])],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
})
export class MaintenanceModule {}
