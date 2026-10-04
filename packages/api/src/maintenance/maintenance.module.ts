import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Alert } from '../alerts/entities/alert.entity.js'
import { Device } from '../devices/devices.entity.js'
import { LogEntry } from '../logs/logs.entity.js'
import { Screen } from '../screens/screens.entity.js'
import { ScreensModule } from '../screens/screens.module.js'
import { SettingsModule } from '../settings/settings.module.js'
import { MaintenanceController } from './maintenance.controller.js'
import { MaintenanceService } from './maintenance.service.js'
import { RetentionService } from './retention.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([Device, Screen, Alert, LogEntry]), SettingsModule, ScreensModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService, RetentionService],
})
export class MaintenanceModule {}
