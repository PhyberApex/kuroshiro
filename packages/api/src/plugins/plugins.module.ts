import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Screen } from '../screens/screens.entity.js'
import { DevicePlugin } from './entities/device-plugin.entity.js'
import { PluginDataSource } from './entities/plugin-data-source.entity.js'
import { PluginFieldValue } from './entities/plugin-field-value.entity.js'
import { PluginField } from './entities/plugin-field.entity.js'
import { PluginTemplate } from './entities/plugin-template.entity.js'
import { Plugin } from './entities/plugin.entity.js'
import { WebhookPluginGuard } from './guards/webhook-plugin.guard.js'
import { PluginsController } from './plugins.controller.js'
import { PluginsService } from './plugins.service.js'
import { PluginDataFetcherService } from './services/plugin-data-fetcher.service.js'
import { PluginExporterService } from './services/plugin-exporter.service.js'
import { PluginImporterService } from './services/plugin-importer.service.js'
import { PluginRenderCacheService } from './services/plugin-render-cache.service.js'
import { PluginRendererService } from './services/plugin-renderer.service.js'
import { PluginSchedulerService } from './services/plugin-scheduler.service.js'
import { PluginTemplateContextService } from './services/plugin-template-context.service.js'
import { PluginTransformService } from './services/plugin-transform.service.js'
import { WebhookIngestService } from './services/webhook-ingest.service.js'
import { WebhookIngestController } from './webhook-ingest.controller.js'

@Module({
  imports: [
    ConfigModule,
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
  controllers: [PluginsController, WebhookIngestController],
  providers: [
    PluginsService,
    PluginDataFetcherService,
    PluginRendererService,
    PluginSchedulerService,
    PluginImporterService,
    PluginExporterService,
    PluginTransformService,
    PluginRenderCacheService,
    PluginTemplateContextService,
    WebhookIngestService,
    WebhookPluginGuard,
  ],
  exports: [PluginsService, PluginSchedulerService, PluginDataFetcherService, PluginRendererService, PluginTransformService, PluginRenderCacheService, PluginTemplateContextService],
})
export class PluginsModule {}
