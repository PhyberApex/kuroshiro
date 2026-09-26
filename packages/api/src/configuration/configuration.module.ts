import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DeviceModel } from '../device-models/entities/device-model.entity.js'
import { Palette } from '../device-models/entities/palette.entity.js'
import { Device } from '../devices/devices.entity.js'
import { Firmware } from '../firmware/entities/firmware.entity.js'
import { MashupConfiguration } from '../mashup/entities/mashup-configuration.entity.js'
import { MashupSlot } from '../mashup/entities/mashup-slot.entity.js'
import { DevicePlugin } from '../plugins/entities/device-plugin.entity.js'
import { PluginDataSource } from '../plugins/entities/plugin-data-source.entity.js'
import { PluginFieldValue } from '../plugins/entities/plugin-field-value.entity.js'
import { PluginField } from '../plugins/entities/plugin-field.entity.js'
import { PluginTemplate } from '../plugins/entities/plugin-template.entity.js'
import { PluginVariable } from '../plugins/entities/plugin-variable.entity.js'
import { Plugin } from '../plugins/entities/plugin.entity.js'
import { PluginsModule } from '../plugins/plugins.module.js'
import { Schedule } from '../schedule/schedule.entity.js'
import { Screen } from '../screens/screens.entity.js'
import { ConfigurationController } from './configuration.controller.js'
import { ConfigurationExportService } from './services/configuration-export.service.js'
import { ConfigurationImportService } from './services/configuration-import.service.js'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Plugin,
      DevicePlugin,
      PluginDataSource,
      PluginTemplate,
      PluginField,
      PluginFieldValue,
      PluginVariable,
      Device,
      DeviceModel,
      Palette,
      Firmware,
      Screen,
      Schedule,
      MashupConfiguration,
      MashupSlot,
    ]),
    PluginsModule,
  ],
  controllers: [ConfigurationController],
  providers: [ConfigurationExportService, ConfigurationImportService],
})
export class ConfigurationModule {}
