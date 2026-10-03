import type { InstanceSettingsResponse } from 'kuroshiro-shared'
import { Body, Controller, Get, Patch } from '@nestjs/common'
import { UpdateInstanceSettingsDto } from './dto/update-instance-settings.dto.js'
import { InstanceSettingsService } from './instance-settings.service.js'

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: InstanceSettingsService) {}

  @Get()
  async get(): Promise<InstanceSettingsResponse> {
    return this.settingsService.get()
  }

  @Patch()
  async update(@Body() dto: UpdateInstanceSettingsDto): Promise<InstanceSettingsResponse> {
    return this.settingsService.update(dto)
  }
}
