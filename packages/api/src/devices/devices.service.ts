import type { Repository } from 'typeorm'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import generateApikey from '../utils/generateApikey'
import generateFriendlyName from '../utils/generateFriendlyName'
import { Device } from './devices.entity'
import { CreateDeviceDto } from './dto/create-device.dto'

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
  ) {}

  async findAll(): Promise<Device[]> {
    return this.deviceRepository.find({ order: { friendlyId: 'ASC' } })
  }

  async findById(id: string): Promise<Device | null> {
    return this.deviceRepository.findOneBy({ id })
  }

  async create(device: CreateDeviceDto): Promise<Device> {
    const friendlyId = generateFriendlyName()
    const apikey = generateApikey()
    const newDevice = this.deviceRepository.create({ ...device, friendlyId, apikey })
    return this.deviceRepository.save(newDevice)
  }

  async update(id: string, newDevice: Partial<Device>): Promise<Device> {
    const dbDevice = await this.deviceRepository.findOneBy({ id })
    if (!dbDevice)
      return null
    Object.assign(dbDevice, newDevice)
    return this.deviceRepository.save(dbDevice)
  }

  async remove(id: string): Promise<boolean> {
    const dbDevice = await this.deviceRepository.findOneBy({ id })
    if (!dbDevice)
      return false
    await this.deviceRepository.remove(dbDevice)
    return true
  }
}
