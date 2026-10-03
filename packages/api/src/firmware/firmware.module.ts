import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DeviceModel } from '../device-models/entities/device-model.entity.js'
import { Device } from '../devices/devices.entity.js'
import { SettingsModule } from '../settings/settings.module.js'
import { SyncRunsModule } from '../sync-runs/sync-runs.module.js'
import { Firmware } from './entities/firmware.entity.js'
import { FirmwareAutoUpdateService } from './firmware-auto-update.service.js'
import { FirmwareReadsService } from './firmware-reads.service.js'
import { FirmwareSyncService } from './firmware-sync.service.js'
import { FirmwareController } from './firmware.controller.js'
import { FirmwareService } from './firmware.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([Firmware, Device, DeviceModel]), ConfigModule, SettingsModule, SyncRunsModule],
  controllers: [FirmwareController],
  providers: [FirmwareService, FirmwareReadsService, FirmwareSyncService, FirmwareAutoUpdateService],
  exports: [FirmwareService],
})
export class FirmwareModule {}
