import type { WebhookRequest } from './guards/webhook-plugin.guard.js'
import { Body, Controller, Get, Header, Post, Req, UseGuards } from '@nestjs/common'
import { WebhookPluginGuard } from './guards/webhook-plugin.guard.js'
import { WebhookIngestService } from './services/webhook-ingest.service.js'

@Controller('webhook')
@UseGuards(WebhookPluginGuard)
export class WebhookIngestController {
  constructor(
    private readonly ingestService: WebhookIngestService,
  ) {}

  /**
   * Serialized here rather than returned as an object because Nest answers a
   * null return with an empty body, and a Plugin with nothing stored yet should
   * still answer with JSON.
   */
  @Get(':token')
  @Header('Content-Type', 'application/json')
  readPayload(@Req() request: WebhookRequest): string {
    return JSON.stringify(this.ingestService.readPayload(request.plugin))
  }

  @Post(':token')
  async ingest(@Req() request: WebhookRequest, @Body() body: unknown) {
    return this.ingestService.ingest(request.plugin, body)
  }
}
