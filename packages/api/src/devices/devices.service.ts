import type { Repository } from 'typeorm'
import type { UpdateDeviceDto } from './dto/update-device.dto'
import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DeviceModelsService } from '../device-models/device-models.service'
import { ScreensService } from '../screens/screens.service'
import generateApikey from '../utils/generateApikey'
import generateFriendlyName from '../utils/generateFriendlyName'
import { Device } from './devices.entity'
import { CreateDeviceDto } from './dto/create-device.dto'

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    private deviceModels: DeviceModelsService,
    private screensService: ScreensService,
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

  async update(id: string, changes: UpdateDeviceDto): Promise<Device> {
    const dbDevice = await this.deviceRepository.findOneBy({ id })
    if (!dbDevice)
      return null
    const { deviceModelName, paletteId, ...attributes } = changes
    Object.assign(dbDevice, attributes)
    const before = { model: dbDevice.deviceModel?.name, palette: dbDevice.palette?.id }
    await this.applyModelChanges(dbDevice, deviceModelName, paletteId)
    const saved = await this.deviceRepository.save(dbDevice)
    if (before.model !== saved.deviceModel?.name || before.palette !== saved.palette?.id)
      await this.screensService.reconvertImageScreens(saved)
    return saved
  }

  async remove(id: string): Promise<boolean> {
    const dbDevice = await this.deviceRepository.findOneBy({ id })
    if (!dbDevice)
      return false
    await this.deviceRepository.remove(dbDevice)
    return true
  }

  private async applyModelChanges(device: Device, deviceModelName?: string, paletteId?: string): Promise<void> {
    if (deviceModelName !== undefined && deviceModelName !== device.deviceModel?.name) {
      const model = await this.deviceModels.findByName(deviceModelName)
      if (!model)
        throw new BadRequestException(`Unknown device model: ${deviceModelName}`)
      device.deviceModel = model
      device.palette = null
    }
    if (device.deviceModel && paletteId !== undefined) {
      const palette = await this.deviceModels.findPalette(paletteId)
      if (!palette || !device.deviceModel.paletteIds.includes(paletteId))
        throw new BadRequestException(`Palette ${paletteId} is not supported by device model ${device.deviceModel.name}`)
      device.palette = palette
    }
    if (device.deviceModel && !device.palette)
      device.palette = await this.deviceModels.defaultPaletteFor(device.deviceModel)
  }
}
