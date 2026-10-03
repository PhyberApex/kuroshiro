import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { InstanceController } from './instance.controller.js'

@Module({
  imports: [ConfigModule],
  controllers: [InstanceController],
})
export class InstanceModule {}
