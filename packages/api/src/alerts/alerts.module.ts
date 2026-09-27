import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Device } from '../devices/devices.entity.js'
import { AlertSweepService } from './alert-sweep.service.js'
import { Alert } from './entities/alert.entity.js'
import { NotificationSenderService } from './notification-sender.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([Alert, Device]), ConfigModule],
  providers: [AlertSweepService, NotificationSenderService],
})
export class AlertsModule {}
