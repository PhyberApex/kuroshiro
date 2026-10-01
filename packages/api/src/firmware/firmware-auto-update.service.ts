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
 * Firmware — only `FirmwareSyncService` calls this, right after a successful insert.
 */
@Injectable()
export class FirmwareAutoUpdateService {
  private readonly logger = new Logger(FirmwareAutoUpdateService.name)

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    private readonly instanceSettingsService: InstanceSettingsService,
  ) {}

  async applyPolicy(firmware: Firmware): Promise<number> {
    if (!await this.instanceSettingsService.resolveFirmwareAutoUpdate())
      return 0

    const candidates = await this.deviceRepository.find({ where: { updateFirmware: false } })
    const eligible = candidates.filter(device =>
      !device.mirrorEnabled
      && device.deviceModel != null
      && isFirmwareCompatible(firmware, device.deviceModel.name),
    )

    for (const device of eligible) {
      device.targetFirmware = firmware
      device.updateFirmware = true
      await this.deviceRepository.save(device)
      this.logger.log(`Auto-assigned firmware ${firmware.version} to device ${device.id}`)
    }

    return eligible.length
  }
}
