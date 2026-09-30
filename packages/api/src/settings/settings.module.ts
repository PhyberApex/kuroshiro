import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { InstanceSettings } from './entities/instance-settings.entity.js'
import { InstanceSettingsService } from './instance-settings.service.js'
import { SettingsController } from './settings.controller.js'

@Module({
  imports: [TypeOrmModule.forFeature([InstanceSettings]), ConfigModule],
  controllers: [SettingsController],
  providers: [InstanceSettingsService],
  exports: [InstanceSettingsService],
})
export class SettingsModule {}
