import type { FirmwareList, FirmwareRead } from 'kuroshiro-shared'
import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Device } from '../devices/devices.entity.js'
import { SyncRunService } from '../sync-runs/sync-run.service.js'
import { fileExists } from '../utils/fileExists.js'
import { Firmware } from './entities/firmware.entity.js'
import { firmwareFilePath } from './firmware-paths.js'
import { toFirmwareList, toFirmwareRead } from './firmware.mapper.js'
import { FirmwareService } from './firmware.service.js'

@Injectable()
export class FirmwareReadsService {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    private readonly firmwareService: FirmwareService,
    private readonly syncRuns: SyncRunService,
  ) {}

  async list(): Promise<FirmwareList> {
    const [rows, devices, lastSync] = await Promise.all([
      this.firmwareService.findAll(),
      this.devicesWithFirmwareFacts(),
      this.syncRuns.last('firmware'),
    ])
    const firmware = await Promise.all(rows.map(row => this.read(row, devices)))
    return toFirmwareList(lastSync, firmware)
  }

  async readById(id: string): Promise<FirmwareRead> {
    const [row, devices] = await Promise.all([this.firmwareService.findById(id), this.devicesWithFirmwareFacts()])
    if (!row)
      throw new NotFoundException(`Firmware ${id} not found`)
    return this.read(row, devices)
  }

  private devicesWithFirmwareFacts(): Promise<Device[]> {
    return this.deviceRepository.find({ select: { id: true, name: true, fwVersion: true, updateFirmware: true, targetFirmware: { id: true } } })
  }

  private async read(firmware: Firmware, devices: Device[]): Promise<FirmwareRead> {
    return toFirmwareRead(firmware, {
      filePresent: await fileExists(firmwareFilePath(firmware.id)),
      targetedBy: devices.filter(device => device.targetFirmware?.id === firmware.id),
      runningOn: devices.filter(device => device.fwVersion === firmware.version),
    })
  }
}
