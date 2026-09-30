import { Controller, Get, Header } from '@nestjs/common'
import { MetricsService } from './metrics.service.js'

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics(): Promise<string> {
    return this.metricsService.render()
  }
}
