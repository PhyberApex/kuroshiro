import type { ScreenRead } from 'kuroshiro-shared'
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post, Put, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common'
import { LimitedFileInterceptor } from '../uploads/limited-file-interceptor.js'
import { UPLOAD_LIMITS } from '../uploads/upload-limits.js'
import { CreateScreenDto } from './dto/create-screen.dto.js'
import { UpdateScreenDto } from './dto/update-screen.dto.js'
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

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateScreenDto): Promise<ScreenRead> {
    return this.screenReads.forScreen(await this.screensService.update(id, body))
  }

  @Post(':id/image-preview')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(LimitedFileInterceptor('file', UPLOAD_LIMITS.imageUploadBytes))
  async previewImage(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File): Promise<StreamableFile> {
    return new StreamableFile(await this.screensService.previewImage(id, file), { type: 'image/png' })
  }

  @Put(':id/image')
  @UseInterceptors(LimitedFileInterceptor('file', UPLOAD_LIMITS.imageUploadBytes))
  async replaceImage(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File): Promise<ScreenRead> {
    return this.screenReads.forScreen(await this.screensService.replaceImage(id, file))
  }

  @Post(':id/refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Param('id') id: string): Promise<ScreenRead> {
    return this.screenReads.forScreen(await this.screensService.refresh(id))
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.screensService.delete(id)
  }
}
