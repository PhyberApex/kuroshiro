import type { DeviceModelList, PaletteRead } from 'kuroshiro-shared'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Device } from '../devices/devices.entity.js'
import { SyncRunService } from '../sync-runs/sync-run.service.js'
import { toDeviceModelList, toDeviceModelRead, toPaletteRead } from './device-models.mapper.js'
import { DeviceModelsService } from './device-models.service.js'
import { compatiblePaletteIds } from './palette-compatibility.js'

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
      usedBy: devices.filter(device => device.deviceModel?.name === model.name),
    })))
  }

  async listPalettes(): Promise<PaletteRead[]> {
    const [palettes, devices] = await Promise.all([this.deviceModels.findAllPalettes(), this.devicesWithAssignments()])
    return palettes.map(palette => toPaletteRead(palette, devices.filter(device => device.palette?.id === palette.id)))
  }

  private devicesWithAssignments(): Promise<Device[]> {
    return this.deviceRepository.find({
      select: { id: true, name: true, deviceModel: { name: true }, palette: { id: true } },
      relations: { deviceModel: true, palette: true },
      loadEagerRelations: false,
    })
  }
}
