import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Device } from '../devices/devices.entity.js'
import { PluginDataSource } from '../plugins/entities/plugin-data-source.entity.js'
import { AlertSweepService } from './alert-sweep.service.js'
import { AlertsController } from './alerts.controller.js'
import { AlertsService } from './alerts.service.js'
import { Alert } from './entities/alert.entity.js'
import { NotificationSenderService } from './notification-sender.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([Alert, Device, PluginDataSource]), ConfigModule],
  controllers: [AlertsController],
  providers: [AlertSweepService, AlertsService, NotificationSenderService],
})
export class AlertsModule {}
