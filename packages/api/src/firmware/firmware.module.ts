import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Firmware } from './entities/firmware.entity.js'
import { FirmwareSyncService } from './firmware-sync.service.js'
import { FirmwareController } from './firmware.controller.js'
import { FirmwareService } from './firmware.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([Firmware]), ConfigModule],
  controllers: [FirmwareController],
  providers: [FirmwareService, FirmwareSyncService],
  exports: [FirmwareService],
})
export class FirmwareModule {}
