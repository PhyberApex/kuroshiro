import type { Repository } from 'typeorm'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Device } from '../devices/devices.entity.js'
import { InstanceSettingsService } from '../settings/instance-settings.service.js'
import { Firmware } from './entities/firmware.entity.js'
import { isFirmwareCompatible } from './firmware-compatibility.js'

/**
 * Applies the Firmware Auto-Update policy (ADR-0029): when the Setting is on and a new
 * official Firmware row lands, assigns it to every eligible Device exactly as an admin
 * would. Never touches a Device with a push already pending, and never runs for `custom`
 * Firmware — `FirmwareSyncService` calls `applyPolicy` right after a successful insert, and
 * the admin's "Catch up now" calls `catchUp` (ADR-0029 addendum).
 */
@Injectable()
export class FirmwareAutoUpdateService {
  private readonly logger = new Logger(FirmwareAutoUpdateService.name)

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(Firmware)
    private readonly firmwareRepository: Repository<Firmware>,
    private readonly instanceSettingsService: InstanceSettingsService,
  ) {}

  async applyPolicy(firmware: Firmware): Promise<Device[]> {
    if (!await this.instanceSettingsService.resolveFirmwareAutoUpdate())
      return []

    return this.assign(firmware, await this.findEligible(firmware))
  }

  /**
   * The Devices "Catch up now" would give the current official Firmware: the eligible ones
   * whose reported version differs from it, or is unknown. Plain inequality, no version
   * ordering (ADR-0029). Empty when the Setting is off or there is no current official row.
   */
  async previewCatchUp(): Promise<{ firmware: Firmware | null, behind: Device[] }> {
    const firmware = await this.findCurrentOfficial()
    if (!firmware)
      return { firmware: null, behind: [] }
    const eligible = await this.findEligible(firmware)
    return { firmware, behind: eligible.filter(device => device.fwVersion !== firmware.version) }
  }

  async catchUp(): Promise<{ firmware: Firmware | null, assigned: Device[] }> {
    const { firmware, behind } = await this.previewCatchUp()
    if (!firmware)
      return { firmware, assigned: [] }
    return { firmware, assigned: await this.assign(firmware, behind) }
  }

  private async findCurrentOfficial(): Promise<Firmware | null> {
    if (!await this.instanceSettingsService.resolveFirmwareAutoUpdate())
      return null
    return this.firmwareRepository.findOne({ where: { kind: 'official-synced', deprecated: false }, order: { syncedAt: 'DESC' } })
  }

  private async findEligible(firmware: Firmware): Promise<Device[]> {
    const candidates = await this.deviceRepository.find({ where: { updateFirmware: false } })
    return candidates.filter(device =>
      !device.mirrorEnabled
      && device.deviceModel != null
      && isFirmwareCompatible(firmware, device.deviceModel.name),
    )
  }

  private async assign(firmware: Firmware, devices: Device[]): Promise<Device[]> {
    for (const device of devices) {
      device.targetFirmware = firmware
      device.updateFirmware = true
      await this.deviceRepository.save(device)
      this.logger.log(`Auto-assigned firmware ${firmware.version} to device ${device.id}`)
    }
    return devices
  }
}
