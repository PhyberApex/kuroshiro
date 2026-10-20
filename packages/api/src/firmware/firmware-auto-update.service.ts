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
 * would. Each folder TRMNL publishes official Firmware in has its own rows (ADR-0065), so
 * "the current official Firmware" is per Device Model. Never touches a Device with a push already pending, and never runs for `custom`
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
   * The Devices "Catch up now" would give the current official Firmware, each the newest
   * non-deprecated official row its Device Model is compatible with (ADR-0065): the eligible
   * ones whose reported version differs from that row's, or is unknown. Plain inequality, no
   * version ordering (ADR-0029). `newest` is the newest such row of any folder; empty when
   * the Setting is off or there is no current official row.
   */
  async previewCatchUp(): Promise<{ newest: Firmware | null, behind: Array<{ device: Device, firmware: Firmware }> }> {
    const current = await this.findCurrentOfficial()
    if (current.length === 0)
      return { newest: null, behind: [] }
    const behind = (await this.findFree()).flatMap((device) => {
      const firmware = current.find(candidate => isFirmwareCompatible(candidate, device.deviceModel?.name))
      return firmware && device.fwVersion !== firmware.version ? [{ device, firmware }] : []
    })
    return { newest: current[0], behind }
  }

  async catchUp(): Promise<{ newest: Firmware | null, assigned: Device[] }> {
    const { newest, behind } = await this.previewCatchUp()
    const assigned: Device[] = []
    for (const { device, firmware } of behind)
      assigned.push(...await this.assign(firmware, [device]))
    return { newest, assigned }
  }

  /** Newest first. */
  private async findCurrentOfficial(): Promise<Firmware[]> {
    if (!await this.instanceSettingsService.resolveFirmwareAutoUpdate())
      return []
    return this.firmwareRepository.find({ where: { kind: 'official-synced', deprecated: false }, order: { syncedAt: 'DESC' } })
  }

  private async findEligible(firmware: Firmware): Promise<Device[]> {
    return (await this.findFree()).filter(device => isFirmwareCompatible(firmware, device.deviceModel?.name))
  }

  /** The Devices the policy may give a Firmware to: not mirrored, with a Device Model and no push pending. */
  private async findFree(): Promise<Device[]> {
    const candidates = await this.deviceRepository.find({ where: { updateFirmware: false } })
    return candidates.filter(device => !device.mirrorEnabled && device.deviceModel != null)
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
