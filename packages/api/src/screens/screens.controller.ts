import {
  Body,
  Controller,
  Delete,
  Get,
  MethodNotAllowedException,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { FileInterceptor } from '@nestjs/platform-express'
import { CreateScreenDto } from './dto/create-screen.dto'
import { Screen } from './screens.entity'
import { ScreensService } from './screens.service'

@Controller('screens')
export class ScreensController {
  constructor(private readonly screensService: ScreensService, private readonly configService: ConfigService) {}

  @Get()
  async getAll(): Promise<Screen[]> {
    return this.screensService.getAll()
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @UseInterceptors(FileInterceptor('file'))
  async add(@Body() body: CreateScreenDto, @UploadedFile() file?: any): Promise<Screen> {
    if (file && this.configService.get<string>('demo_mode'))
      throw new MethodNotAllowedException('Not available in demo mode')
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
