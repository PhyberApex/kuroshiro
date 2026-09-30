import type { InstanceSettingsResponse } from 'kuroshiro-shared'
import { Body, Controller, Get, Patch, UsePipes, ValidationPipe } from '@nestjs/common'
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
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async update(@Body() dto: UpdateInstanceSettingsDto): Promise<InstanceSettingsResponse> {
    return this.settingsService.update(dto)
  }
}
