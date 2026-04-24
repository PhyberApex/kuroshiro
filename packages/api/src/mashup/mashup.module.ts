import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Device } from '../devices/devices.entity'
import { Plugin } from '../plugins/entities/plugin.entity'
import { PluginsModule } from '../plugins/plugins.module'
import { Screen } from '../screens/screens.entity'
import { MashupConfiguration } from './entities/mashup-configuration.entity'
import { MashupSlot } from './entities/mashup-slot.entity'
import { MashupController } from './mashup.controller'
import { MashupService } from './mashup.service'
import { MashupRendererService } from './services/mashup-renderer.service'

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
    ConfigModule,
  ],
  controllers: [MashupController],
  providers: [MashupService, MashupRendererService],
  exports: [MashupService, MashupRendererService],
})
export class MashupModule {}
