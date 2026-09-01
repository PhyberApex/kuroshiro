import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DeviceSensorsModule } from '../device-sensors/device-sensors.module.js'
import { Device } from '../devices/devices.entity.js'
import { Plugin } from '../plugins/entities/plugin.entity.js'
import { PluginsModule } from '../plugins/plugins.module.js'
import { Screen } from '../screens/screens.entity.js'
import { MashupConfiguration } from './entities/mashup-configuration.entity.js'
import { MashupSlot } from './entities/mashup-slot.entity.js'
import { MashupController } from './mashup.controller.js'
import { MashupService } from './mashup.service.js'
import { MashupRendererService } from './services/mashup-renderer.service.js'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Screen,
      Device,
      MashupConfiguration,
      MashupSlot,
      Plugin,
    ]),
    PluginsModule,
    DeviceSensorsModule,
    ConfigModule,
  ],
  controllers: [MashupController],
  providers: [MashupService, MashupRendererService],
  exports: [MashupService, MashupRendererService],
})
export class MashupModule {}
