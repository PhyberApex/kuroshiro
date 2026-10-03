import type { ScreenRead } from 'kuroshiro-shared'
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common'
import { LimitedFileInterceptor } from '../uploads/limited-file-interceptor.js'
import { UPLOAD_LIMITS } from '../uploads/upload-limits.js'
import { CreateScreenDto } from './dto/create-screen.dto.js'
import { ScreenReadsService } from './screen-reads.service.js'
import { ScreensService } from './screens.service.js'

@Controller('screens')
export class ScreensController {
  constructor(private readonly screensService: ScreensService, private readonly screenReads: ScreenReadsService) {}

  @Post()
  @UseInterceptors(LimitedFileInterceptor('file', UPLOAD_LIMITS.imageUploadBytes))
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
