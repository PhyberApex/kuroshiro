import type { PaletteRead } from 'kuroshiro-shared'
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common'
import { CustomPalettesService } from './custom-palettes.service.js'
import { DeviceModelReadsService } from './device-model-reads.service.js'
import { CreateCustomPaletteDto } from './dto/create-custom-palette.dto.js'
import { UpdateCustomPaletteDto } from './dto/update-custom-palette.dto.js'

@Controller('device-models/palettes')
export class CustomPalettesController {
  constructor(
    private readonly customPalettes: CustomPalettesService,
    private readonly reads: DeviceModelReadsService,
  ) {}

  @Post()
  async create(@Body() dto: CreateCustomPaletteDto): Promise<PaletteRead> {
    return this.reads.palette(await this.customPalettes.create(dto))
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCustomPaletteDto): Promise<PaletteRead> {
    await this.customPalettes.update(id, dto)
    return this.reads.palette(id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string): Promise<void> {
    return this.customPalettes.delete(id)
  }
}
