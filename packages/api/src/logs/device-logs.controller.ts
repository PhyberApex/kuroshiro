import type { DeviceLogPage } from 'kuroshiro-shared'
import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Query } from '@nestjs/common'
import { DeviceLogsService } from './device-logs.service.js'
import { ListDeviceLogsQueryDto } from './dto/list-device-logs-query.dto.js'

@Controller('devices/:id/logs')
export class DeviceLogsController {
  constructor(private readonly deviceLogs: DeviceLogsService) {}

  @Get()
  async page(@Param('id') id: string, @Query() query: ListDeviceLogsQueryDto): Promise<DeviceLogPage> {
    return this.deviceLogs.page(id, query)
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async clear(@Param('id') id: string): Promise<void> {
    await this.deviceLogs.clear(id)
  }
}
