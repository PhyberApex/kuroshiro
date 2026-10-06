import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DeviceModelsModule } from '../device-models/device-models.module.js'
import { DeviceSensorsModule } from '../device-sensors/device-sensors.module.js'
import { Device } from '../devices/devices.entity.js'
import { Plugin } from '../plugins/entities/plugin.entity.js'
import { PluginsModule } from '../plugins/plugins.module.js'
import { Screen } from '../screens/screens.entity.js'
import { ScreensModule } from '../screens/screens.module.js'
import { MashupConfiguration } from './entities/mashup-configuration.entity.js'
import { MashupSlot } from './entities/mashup-slot.entity.js'
import { MashupController } from './mashup.controller.js'
import { MashupService } from './mashup.service.js'
import { MashupRendererService } from './services/mashup-renderer.service.js'
import { ScreenRenderService } from './services/screen-render.service.js'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Screen,
      Device,
      MashupConfiguration,
      MashupSlot,
      Plugin,
    ]),
    ConfigModule,
    PluginsModule,
    ScreensModule,
    DeviceSensorsModule,
    DeviceModelsModule,
  ],
  controllers: [MashupController],
  providers: [MashupService, MashupRendererService, ScreenRenderService],
  exports: [MashupService, MashupRendererService, ScreenRenderService],
})
export class MashupModule {}
