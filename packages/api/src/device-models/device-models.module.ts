import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DeviceModelSyncService } from './device-model-sync.service'
import { DeviceModelsController } from './device-models.controller'
import { DeviceModelsService } from './device-models.service'
import { DeviceModel } from './entities/device-model.entity'
import { Palette } from './entities/palette.entity'

@Module({
  imports: [TypeOrmModule.forFeature([DeviceModel, Palette])],
  controllers: [DeviceModelsController],
  providers: [DeviceModelsService, DeviceModelSyncService],
  exports: [DeviceModelsService],
})
export class DeviceModelsModule {}
