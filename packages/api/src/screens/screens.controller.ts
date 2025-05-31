import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { CreateScreenDto } from './dto/create-screen.dto'
import { Screen } from './screens.entity'
import { ScreensService } from './screens.service'

@Controller('screens')
export class ScreensController {
  constructor(private readonly screensService: ScreensService) {}

  @Get()
  async getAll(): Promise<Screen[]> {
    return this.screensService.getAll()
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @UseInterceptors(FileInterceptor('file'))
  async add(@Body() body: CreateScreenDto, @UploadedFile() file?: any): Promise<Screen> {
    return this.screensService.add(body, file)
  }

  @Get('device/:deviceId')
  async getByDevice(@Param('deviceId') deviceId: string): Promise<Screen[]> {
    return this.screensService.getByDevice(deviceId)
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    await this.screensService.delete(id)
  }

  @Post(':id')
  async updateExternalScreen(@Param('id') id: string): Promise<void> {
    await this.screensService.updateExternalScreen(id)
  }
}
