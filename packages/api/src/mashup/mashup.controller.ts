import type { ScreenRead } from 'kuroshiro-shared'
import type { Screen } from '../screens/screens.entity.js'
import type { MashupConfiguration } from './entities/mashup-configuration.entity.js'
import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common'
import { ScreenReadsService } from '../screens/screen-reads.service.js'
import { CreateMashupDto } from './dto/create-mashup.dto.js'
import { UpdateMashupDto } from './dto/update-mashup.dto.js'
import { MashupService } from './mashup.service.js'

@Controller('mashup')
export class MashupController {
  constructor(private readonly mashupService: MashupService, private readonly screenReads: ScreenReadsService) {}

  @Post()
  async create(@Body() dto: CreateMashupDto): Promise<ScreenRead> {
    return this.screenReads.forScreen(await this.mashupService.create(dto))
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateMashupDto): Promise<Screen> {
    return this.mashupService.update(id, dto)
  }

  @Get(':id/configuration')
  async getConfiguration(@Param('id') id: string): Promise<MashupConfiguration> {
    return this.mashupService.getConfiguration(id)
  }

  @Get('layouts')
  getLayouts() {
    return this.mashupService.getLayouts()
  }
}
