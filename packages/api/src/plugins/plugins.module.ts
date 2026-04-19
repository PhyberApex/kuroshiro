import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Screen } from '../screens/screens.entity'
import { DevicePlugin } from './entities/device-plugin.entity'
import { PluginDataSource } from './entities/plugin-data-source.entity'
import { PluginFieldValue } from './entities/plugin-field-value.entity'
import { PluginField } from './entities/plugin-field.entity'
import { PluginTemplate } from './entities/plugin-template.entity'
import { Plugin } from './entities/plugin.entity'
import { PluginsController } from './plugins.controller'
import { PluginsService } from './plugins.service'
import { PluginDataFetcherService } from './services/plugin-data-fetcher.service'
import { PluginExporterService } from './services/plugin-exporter.service'
import { PluginImporterService } from './services/plugin-importer.service'
import { PluginRendererService } from './services/plugin-renderer.service'
import { PluginSchedulerService } from './services/plugin-scheduler.service'
import { PluginTransformService } from './services/plugin-transform.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Plugin,
      DevicePlugin,
      PluginDataSource,
      PluginTemplate,
      PluginField,
      PluginFieldValue,
      Screen,
    ]),
  ],
  controllers: [PluginsController],
  providers: [
    PluginsService,
    PluginDataFetcherService,
    PluginRendererService,
    PluginSchedulerService,
    PluginImporterService,
    PluginExporterService,
    PluginTransformService,
  ],
  exports: [PluginsService, PluginSchedulerService, PluginDataFetcherService, PluginRendererService, PluginTransformService],
})
export class PluginsModule {}
