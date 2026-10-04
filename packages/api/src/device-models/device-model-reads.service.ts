import type { DeviceModelList, PaletteRead } from 'kuroshiro-shared'
import type { Palette } from './entities/palette.entity.js'
import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Device } from '../devices/devices.entity.js'
import { SyncRunService } from '../sync-runs/sync-run.service.js'
import { toDeviceModelList, toDeviceModelRead, toPaletteRead } from './device-models.mapper.js'
import { defaultPaletteAmong, DeviceModelsService } from './device-models.service.js'
import { compatiblePaletteIds } from './palette-compatibility.js'

function devicesOn(palette: Palette, devices: Device[]): Device[] {
  return devices.filter(device => device.palette?.id === palette.id)
}

@Injectable()
export class DeviceModelReadsService {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    private readonly deviceModels: DeviceModelsService,
    private readonly syncRuns: SyncRunService,
  ) {}

  async listModels(): Promise<DeviceModelList> {
    const [models, palettes, devices, lastSync] = await Promise.all([
      this.deviceModels.findAll(),
      this.deviceModels.findAllPalettes(),
      this.devicesWithAssignments(),
      this.syncRuns.last('device-models'),
    ])
    return toDeviceModelList(lastSync, models.map(model => toDeviceModelRead(model, {
      paletteIds: compatiblePaletteIds(model, palettes),
      defaultPaletteId: defaultPaletteAmong(model, palettes)?.id ?? null,
      usedBy: devices.filter(device => device.deviceModel?.name === model.name),
    })))
  }

  async listPalettes(): Promise<PaletteRead[]> {
    const [palettes, devices] = await Promise.all([this.deviceModels.findAllPalettes(), this.devicesWithAssignments()])
    return palettes.map(palette => toPaletteRead(palette, devicesOn(palette, devices)))
  }

  /** One Palette with the Devices set to it, as it stands now. */
  async palette(id: string): Promise<PaletteRead> {
    const palette = await this.deviceModels.findPalette(id)
    if (!palette)
      throw new NotFoundException(`Palette ${id} not found`)
    return toPaletteRead(palette, devicesOn(palette, await this.devicesWithAssignments()))
  }

  private devicesWithAssignments(): Promise<Device[]> {
    return this.deviceRepository.find({
      select: { id: true, name: true, deviceModel: { name: true }, palette: { id: true } },
      relations: { deviceModel: true, palette: true },
      loadEagerRelations: false,
    })
  }
}
