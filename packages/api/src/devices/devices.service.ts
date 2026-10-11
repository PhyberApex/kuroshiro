import type { Repository } from 'typeorm'
import type { UpdateDeviceDto } from './dto/update-device.dto.js'
import { HttpStatus, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { ILike } from 'typeorm'
import { DeviceModelsService } from '../device-models/device-models.service.js'
import { PaletteSelectionService } from '../device-models/palette-selection.service.js'
import { ApiException } from '../errors/api.exception.js'
import { FirmwareService } from '../firmware/firmware.service.js'
import { ScreensService } from '../screens/screens.service.js'
import generateApikey from '../utils/generateApikey.js'
import generateFriendlyName from '../utils/generateFriendlyName.js'
import { DeviceSleepImageService } from './device-sleep-image.service.js'
import {
  applyFirmwareChanges,
  applyModelChange,
  applyPaletteChange,
  assertPushCanBeServed,
  assertSleepWindowConfigured,
  renderTargetChanged,
} from './device-update-rules.js'
import { isProxied } from './device.mapper.js'
import { Device } from './devices.entity.js'
import { CreateDeviceDto } from './dto/create-device.dto.js'

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    private deviceModels: DeviceModelsService,
    private paletteSelection: PaletteSelectionService,
    private firmwareService: FirmwareService,
    private screensService: ScreensService,
    private deviceSleepImage: DeviceSleepImageService,
  ) {}

  async findById(id: string): Promise<Device | null> {
    return this.deviceRepository.findOneBy({ id })
  }

  async create(device: CreateDeviceDto): Promise<Device> {
    if (await this.isMacRegistered(device.mac))
      throw new ApiException(HttpStatus.CONFLICT, 'device-mac-taken', 'A Device with this MAC address is already registered.', { mac: device.mac })
    const friendlyId = generateFriendlyName()
    const apikey = generateApikey()
    const newDevice = this.deviceRepository.create({ ...device, friendlyId, apikey })
    return this.deviceRepository.save(newDevice)
  }

  async update(id: string, changes: UpdateDeviceDto): Promise<Device | null> {
    const dbDevice = await this.findByIdOrNull(id)
    if (!dbDevice)
      return null
    const { deviceModelName, paletteId, targetFirmwareId, ...attributes } = changes
    const pushWasPending = dbDevice.updateFirmware
    Object.assign(dbDevice, attributes)
    assertSleepWindowConfigured(dbDevice)
    const before = { model: dbDevice.deviceModel?.name, palette: dbDevice.palette?.id }
    await applyModelChange(dbDevice, deviceModelName, this.deviceModels)
    await applyPaletteChange(dbDevice, paletteId, this.paletteSelection)
    await applyFirmwareChanges(dbDevice, targetFirmwareId, pushWasPending, this.firmwareService)
    assertPushCanBeServed(dbDevice, changes.updateFirmware)
    const saved = await this.deviceRepository.save(dbDevice)
    if (renderTargetChanged(before, saved)) {
      await this.screensService.reconvertImageScreens(saved)
      await this.deviceSleepImage.reconvert(saved)
    }
    return saved
  }

  /** Replaces the Device's apikey at once, as `generateApikey` would at registration; refused on a Proxied Device, which TRMNL authenticates (ADR-0039). */
  async regenerateApikey(id: string): Promise<Device | null> {
    const device = await this.findByIdOrNull(id)
    if (!device)
      return null
    if (isProxied(device))
      throw new ApiException(HttpStatus.CONFLICT, 'device-apikey-proxied', 'A Proxied Device is not given a new API key here.', { id })
    device.apikey = generateApikey()
    return this.deviceRepository.save(device)
  }

  async remove(id: string): Promise<boolean> {
    const dbDevice = await this.findByIdOrNull(id)
    if (!dbDevice)
      return false
    await this.deviceRepository.remove(dbDevice)
    return true
  }

  /** A Device that registered itself through `/api/setup` keeps the letter case it sent, so the comparison ignores it. */
  private async isMacRegistered(mac: string): Promise<boolean> {
    return (await this.deviceRepository.findOneBy({ mac: ILike(mac) })) != null
  }

  private async findByIdOrNull(id: string): Promise<Device | null> {
    return isUUID(id) ? this.deviceRepository.findOneBy({ id }) : null
  }
}
