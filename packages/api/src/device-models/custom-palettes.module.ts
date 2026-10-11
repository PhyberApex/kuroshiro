import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DeviceSleepImageModule } from '../devices/device-sleep-image.module.js'
import { Device } from '../devices/devices.entity.js'
import { ScreensModule } from '../screens/screens.module.js'
import { CustomPalettesController } from './custom-palettes.controller.js'
import { CustomPalettesService } from './custom-palettes.service.js'
import { DeviceModelsModule } from './device-models.module.js'
import { Palette } from './entities/palette.entity.js'

/** Apart from DeviceModelsModule because a change converts stored images again, and ScreensModule already depends on DeviceModelsModule. */
@Module({
  imports: [TypeOrmModule.forFeature([Palette, Device]), DeviceModelsModule, ScreensModule, DeviceSleepImageModule],
  controllers: [CustomPalettesController],
  providers: [CustomPalettesService],
})
export class CustomPalettesModule {}
