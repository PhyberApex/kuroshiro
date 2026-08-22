import type { Repository } from 'typeorm'
import type { DeviceModel } from '../device-models/entities/device-model.entity'
import type { Palette } from '../device-models/entities/palette.entity'
import type { UpdateDeviceDto } from './dto/update-device.dto'
import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DeviceModelsService } from '../device-models/device-models.service'
import { FirmwareService } from '../firmware/firmware.service'
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
    private firmwareService: FirmwareService,
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

  async update(id: string, changes: UpdateDeviceDto): Promise<Device | null> {
    const dbDevice = await this.deviceRepository.findOneBy({ id })
    if (!dbDevice)
      return null
    const { deviceModelName, paletteId, targetFirmwareId, ...attributes } = changes
    Object.assign(dbDevice, attributes)
    const before = { model: dbDevice.deviceModel?.name, palette: dbDevice.palette?.id }
    await this.applyModelChanges(dbDevice, deviceModelName, paletteId)
    await this.applyFirmwareChanges(dbDevice, targetFirmwareId)
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
    if (paletteId !== undefined) {
      if (!device.deviceModel)
        throw new BadRequestException('Cannot set a palette on a device with no assigned device model')
      const palette = await this.deviceModels.findPalette(paletteId)
      if (!palette || !(await this.paletteSupportedBy(palette, device.deviceModel)))
        throw new BadRequestException(`Palette ${paletteId} is not supported by device model ${device.deviceModel.name}`)
      device.palette = palette
    }
    if (device.deviceModel && !device.palette)
      device.palette = await this.deviceModels.defaultPaletteFor(device.deviceModel)
  }

  /**
   * Official palettes are validated against the model's curated `paletteIds`;
   * custom palettes have no per-model list, so compatibility is derived from
   * whether the palette's colour family is already represented on the model.
   */
  private async paletteSupportedBy(palette: Palette, model: DeviceModel): Promise<boolean> {
    if (palette.kind === 'official')
      return model.paletteIds.includes(palette.id)
    const compatibleFamilies = await this.deviceModels.compatibleFamiliesFor(model)
    return compatibleFamilies.has(palette.frameworkClass)
  }

  private async applyFirmwareChanges(device: Device, targetFirmwareId?: string): Promise<void> {
    if (targetFirmwareId === undefined)
      return
    const firmware = await this.firmwareService.findById(targetFirmwareId)
    if (!firmware)
      throw new BadRequestException(`Unknown firmware: ${targetFirmwareId}`)
    if (firmware.compatibleModels.length > 0 && !firmware.compatibleModels.includes(device.deviceModel?.name ?? ''))
      throw new BadRequestException(`Firmware ${targetFirmwareId} is not compatible with device model ${device.deviceModel?.name ?? 'unknown'}`)
    device.targetFirmware = firmware
  }
}
