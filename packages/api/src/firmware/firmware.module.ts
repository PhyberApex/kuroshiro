import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Device } from '../devices/devices.entity.js'
import { SettingsModule } from '../settings/settings.module.js'
import { Firmware } from './entities/firmware.entity.js'
import { FirmwareAutoUpdateService } from './firmware-auto-update.service.js'
import { FirmwareSyncService } from './firmware-sync.service.js'
import { FirmwareController } from './firmware.controller.js'
import { FirmwareService } from './firmware.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([Firmware, Device]), ConfigModule, SettingsModule],
  controllers: [FirmwareController],
  providers: [FirmwareService, FirmwareSyncService, FirmwareAutoUpdateService],
  exports: [FirmwareService],
})
export class FirmwareModule {}
