import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Alert } from '../alerts/entities/alert.entity.js'
import { Device } from '../devices/devices.entity.js'
import { MetricsController } from './metrics.controller.js'
import { MetricsService } from './metrics.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([Device, Alert])],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
