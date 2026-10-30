import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common'
import { DeviceHeaders } from '../devices/device-headers.decorator.js'
import { DeviceCredentialsHeadersDto } from '../devices/dto/device-credentials-headers.dto.js'
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
  async consumeLog(@DeviceHeaders(DeviceCredentialsHeadersDto) headers: DeviceCredentialsHeadersDto, @Body() body: CreateLogDto) {
    this.logger.debug(`Got log ${JSON.stringify(body)}`)
    await this.logsService.addLogToDevice(headers, body)
  }
}
