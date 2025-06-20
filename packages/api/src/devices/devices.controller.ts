import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common'
import { Device } from './devices.entity'
import { DevicesService } from './devices.service'
import { CreateDeviceDto } from './dto/create-device.dto'
import { UpdateDeviceDto } from './dto/update-device.dto'

function isValidMac(mac: string): boolean {
  return /^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(mac)
}

@Controller('devices')
export class DevicesController {
  private readonly logger = new Logger(DevicesController.name)

  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  async getAll(): Promise<Device[]> {
    return this.devicesService.findAll()
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async add(@Body() device: CreateDeviceDto): Promise<Device> {
    if (!device.mac || !isValidMac(device.mac)) {
      throw new BadRequestException('Invalid or missing MAC address')
    }
    return this.devicesService.create(device)
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    const removed = await this.devicesService.remove(id)
    if (!removed) {
      this.logger.warn(`Device not found: ${id}`)
      throw new NotFoundException('Device not found')
    }
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async update(@Param('id') id: string, @Body() newDevice: UpdateDeviceDto): Promise<void> {
    const dbDevice = await this.devicesService.findById(id)
    if (!dbDevice) {
      this.logger.warn(`Device not found: ${id}`)
      throw new NotFoundException('Device not found')
    }
    await this.devicesService.update(id, newDevice)
  }
}
