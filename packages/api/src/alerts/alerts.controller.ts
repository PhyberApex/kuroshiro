import type { AlertsList } from 'kuroshiro-shared'
import { Controller, Get, HttpCode, Logger, Post, Query } from '@nestjs/common'
import { AlertsService } from './alerts.service.js'
import { ListAlertsQueryDto } from './dto/list-alerts-query.dto.js'

@Controller('alerts')
export class AlertsController {
  private readonly logger = new Logger(AlertsController.name)

  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  async list(@Query() query: ListAlertsQueryDto): Promise<AlertsList> {
    return this.alertsService.list(query.resolvedSince)
  }

  @Post('test-notification')
  @HttpCode(200)
  async sendTestNotification(): Promise<{ message: string }> {
    this.logger.log('Test notification requested')
    return this.alertsService.sendTestNotification()
  }
}
