import { Body, Controller, Delete, Get, Headers, Logger, Param, Post, UsePipes, ValidationPipe } from '@nestjs/common'
import { CreateLogDto } from './dto/create-log.dto'
import { LogEntry } from './logs.entity'
import { LogsService } from './logs.service'

@Controller('log')
export class LogsController {
  private readonly logger = new Logger(LogsController.name)
  constructor(private readonly logsService: LogsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async consumeLog(@Headers() headers: { id: string }, @Body() body: CreateLogDto) {
    this.logger.debug(`Got log ${JSON.stringify(body)}`)
    await this.logsService.addLogToDevice(headers.id, body)
  }

  @Get('/device/:deviceId')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async getLogsByDevice(@Param('deviceId') deviceId: string): Promise<LogEntry[]> {
    return this.logsService.getByDevice(deviceId)
  }

  @Delete('/device/:deviceId')
  async clearLogs(@Param('deviceId') deviceId: string) {
    await this.logsService.clearLogsByDeviceId(deviceId)
  }
}
