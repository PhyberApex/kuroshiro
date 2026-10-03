import type { ScreenRead } from 'kuroshiro-shared'
import { Body, Controller, Param, Patch, Post } from '@nestjs/common'
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

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateMashupDto): Promise<ScreenRead> {
    return this.screenReads.forScreen(await this.mashupService.update(id, dto))
  }
}
