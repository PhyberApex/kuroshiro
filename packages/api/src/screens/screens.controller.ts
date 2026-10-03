import type { ScreenRead } from 'kuroshiro-shared'
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { CreateScreenDto } from './dto/create-screen.dto.js'
import { ScreenReadsService } from './screen-reads.service.js'
import { ScreensService } from './screens.service.js'

@Controller('screens')
export class ScreensController {
  constructor(private readonly screensService: ScreensService, private readonly screenReads: ScreenReadsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async add(@Body() body: CreateScreenDto, @UploadedFile() file?: Express.Multer.File): Promise<ScreenRead> {
    return this.screenReads.forScreen(await this.screensService.add(body, file))
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.screensService.delete(id)
  }

  @Post(':id')
  async updateExternalScreen(@Param('id') id: string): Promise<void> {
    await this.screensService.updateExternalScreen(id)
  }
}
