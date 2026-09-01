import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DeviceSensorsService } from './device-sensors.service.js'
import { DeviceSensor } from './entities/device-sensor.entity.js'

@Module({
  imports: [TypeOrmModule.forFeature([DeviceSensor])],
  providers: [DeviceSensorsService],
  exports: [DeviceSensorsService],
})
export class DeviceSensorsModule {}
