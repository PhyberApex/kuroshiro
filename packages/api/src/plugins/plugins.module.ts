import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Screen } from '../screens/screens.entity'
import { DevicePlugin } from './entities/device-plugin.entity'
import { PluginDataSource } from './entities/plugin-data-source.entity'
import { PluginFieldValue } from './entities/plugin-field-value.entity'
import { PluginField } from './entities/plugin-field.entity'
import { PluginTemplate } from './entities/plugin-template.entity'
import { Plugin } from './entities/plugin.entity'
import { WebhookPluginGuard } from './guards/webhook-plugin.guard'
import { PluginsController } from './plugins.controller'
import { PluginsService } from './plugins.service'
import { PluginDataFetcherService } from './services/plugin-data-fetcher.service'
import { PluginDataResolverService } from './services/plugin-data-resolver.service'
import { PluginExporterService } from './services/plugin-exporter.service'
import { PluginImporterService } from './services/plugin-importer.service'
import { PluginRenderCacheService } from './services/plugin-render-cache.service'
import { PluginRendererService } from './services/plugin-renderer.service'
import { PluginSchedulerService } from './services/plugin-scheduler.service'
import { PluginTemplateContextService } from './services/plugin-template-context.service'
import { PluginTransformService } from './services/plugin-transform.service'
import { WebhookIngestService } from './services/webhook-ingest.service'
import { WebhookIngestController } from './webhook-ingest.controller'

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
    PluginDataResolverService,
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
  exports: [PluginsService, PluginSchedulerService, PluginDataFetcherService, PluginDataResolverService, PluginRendererService, PluginTransformService, PluginRenderCacheService, PluginTemplateContextService],
})
export class PluginsModule {}
