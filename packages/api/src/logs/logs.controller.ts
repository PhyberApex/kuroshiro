import { Body, Controller, Delete, Get, Headers, HttpCode, Logger, Param, Post } from '@nestjs/common'
import { DeviceFacing } from '../errors/device-facing.decorator.js'
import { CreateLogDto } from './dto/create-log.dto.js'
import { LogEntry } from './logs.entity.js'
import { LogsService } from './logs.service.js'

@Controller('log')
export class LogsController {
  private readonly logger = new Logger(LogsController.name)
  constructor(private readonly logsService: LogsService) {}

  @Post()
  @HttpCode(204)
  @DeviceFacing()
  async consumeLog(@Headers() headers: { id: string }, @Body() body: CreateLogDto) {
    this.logger.debug(`Got log ${JSON.stringify(body)}`)
    await this.logsService.addLogToDevice(headers.id, body)
  }

  @Get('/device/:deviceId')
  async getLogsByDevice(@Param('deviceId') deviceId: string): Promise<LogEntry[]> {
    return this.logsService.getByDevice(deviceId)
  }

  @Delete('/device/:deviceId')
  async clearLogs(@Param('deviceId') deviceId: string) {
    await this.logsService.clearLogsByDeviceId(deviceId)
  }
}
