import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Alert } from '../alerts/entities/alert.entity.js'
import { DeviceSensor } from '../device-sensors/entities/device-sensor.entity.js'
import { Device } from '../devices/devices.entity.js'
import { PluginDataSource } from '../plugins/entities/plugin-data-source.entity.js'
import { MetricsController } from './metrics.controller.js'
import { MetricsService } from './metrics.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([Device, Alert, DeviceSensor, PluginDataSource])],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
