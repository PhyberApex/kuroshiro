import type { DeviceDetail, DeviceSummary } from 'kuroshiro-shared'
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
} from '@nestjs/common'
import { ApiException } from '../errors/api.exception.js'
import { DeviceReadsService } from './device-reads.service.js'
import { Device } from './devices.entity.js'
import { DevicesService } from './devices.service.js'
import { CreateDeviceDto } from './dto/create-device.dto.js'
import { UpdateDeviceDto } from './dto/update-device.dto.js'

function isValidMac(mac: string): boolean {
  return /^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(mac)
}

@Controller('devices')
export class DevicesController {
  private readonly logger = new Logger(DevicesController.name)

  constructor(
    private readonly devicesService: DevicesService,
    private readonly deviceReads: DeviceReadsService,
  ) {}

  @Get()
  async getAll(): Promise<DeviceSummary[]> {
    return this.deviceReads.list()
  }

  @Get(':id')
  async getOne(@Param('id') id: string): Promise<DeviceDetail> {
    return this.deviceReads.detail(id)
  }

  @Post()
  async add(@Body() device: CreateDeviceDto): Promise<Device> {
    if (!device.mac || !isValidMac(device.mac)) {
      throw new BadRequestException('Invalid or missing MAC address')
    }
    return this.devicesService.create(device)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    if (!(await this.devicesService.remove(id)))
      throw this.deviceNotFound(id)
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() changes: UpdateDeviceDto): Promise<DeviceDetail> {
    if (!(await this.devicesService.update(id, changes)))
      throw this.deviceNotFound(id)
    return this.deviceReads.detail(id)
  }

  private deviceNotFound(id: string): ApiException {
    this.logger.warn(`Device not found: ${id}`)
    return new ApiException(HttpStatus.NOT_FOUND, 'device-not-found', 'Device not found', { id })
  }
}
