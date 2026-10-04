import { Body, Controller, Headers, HttpCode, Logger, Post } from '@nestjs/common'
import { OutsideAdminApi } from '../errors/outside-admin-api.decorator.js'
import { CreateLogDto } from './dto/create-log.dto.js'
import { LogsService } from './logs.service.js'

@Controller('log')
export class LogsController {
  private readonly logger = new Logger(LogsController.name)
  constructor(private readonly logsService: LogsService) {}

  @Post()
  @HttpCode(204)
  @OutsideAdminApi()
  async consumeLog(@Headers() headers: { id: string }, @Body() body: CreateLogDto) {
    this.logger.debug(`Got log ${JSON.stringify(body)}`)
    await this.logsService.addLogToDevice(headers.id, body)
  }
}
