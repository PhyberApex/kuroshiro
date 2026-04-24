import type { Screen } from '../screens/screens.entity'
import type { MashupConfiguration } from './entities/mashup-configuration.entity'
import { Body, Controller, Delete, Get, Param, Post, Put, UsePipes, ValidationPipe } from '@nestjs/common'
import { CreateMashupDto } from './dto/create-mashup.dto'
import { UpdateMashupDto } from './dto/update-mashup.dto'
import { MashupService } from './mashup.service'

@Controller('mashup')
export class MashupController {
  constructor(private readonly mashupService: MashupService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() dto: CreateMashupDto): Promise<Screen> {
    return this.mashupService.create(dto)
  }

  @Put(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async update(@Param('id') id: string, @Body() dto: UpdateMashupDto): Promise<Screen> {
    return this.mashupService.update(id, dto)
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    return this.mashupService.delete(id)
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
