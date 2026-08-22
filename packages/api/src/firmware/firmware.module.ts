import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Firmware } from './entities/firmware.entity'
import { FirmwareSyncService } from './firmware-sync.service'
import { FirmwareController } from './firmware.controller'
import { FirmwareService } from './firmware.service'

@Module({
  imports: [TypeOrmModule.forFeature([Firmware]), ConfigModule],
  controllers: [FirmwareController],
  providers: [FirmwareService, FirmwareSyncService],
  exports: [FirmwareService],
})
export class FirmwareModule {}
