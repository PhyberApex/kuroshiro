import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { InstanceTimeZone } from './instance-time-zone.js'
import { InstanceController } from './instance.controller.js'

@Module({
  imports: [ConfigModule],
  controllers: [InstanceController],
  providers: [InstanceTimeZone],
  exports: [InstanceTimeZone],
})
export class InstanceModule {}
