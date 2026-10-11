import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { Repository } from 'typeorm'
import { Device } from '../devices/devices.entity.js'
import { nextRotationAt } from '../devices/next-poll.js'
import { ApiException } from '../errors/api.exception.js'
import { isPassedOver } from '../schedule/rotation.js'
import { Screen } from './screens.entity.js'

/**
 * Sets and clears a Device's Picked Screen ("Show next" / "Back to Order").
 * Rotation itself (`DeviceDisplayService`) serves and clears the pick at the
 * next poll; this only decides whether a pick may be made (ADR-0038).
 */
@Injectable()
export class PickedScreenService {
  private readonly logger = new Logger(PickedScreenService.name)

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(Screen)
    private readonly screenRepository: Repository<Screen>,
  ) {}

  /** Refused with a 4xx when the Screen belongs to another Device, the Device has no Rotation to pick in, the Screen is already Active, or Rotation could not show it at the next poll. */
  async set(deviceId: string, screenId: string): Promise<void> {
    const device = await this.deviceOrRefuse(deviceId)
    const screen = await this.screenOrRefuse(screenId)
    if (screen.device.id !== device.id)
      throw new ApiException(HttpStatus.BAD_REQUEST, 'picked-screen-wrong-device', 'That Screen does not belong to this Device.', { deviceId, screenId })
    if (device.mirrorEnabled)
      throw new ApiException(HttpStatus.CONFLICT, 'picked-screen-mirrored', 'A mirrored Device has no Rotation to pick in.', { deviceId })
    if (screen.isActive)
      throw new ApiException(HttpStatus.CONFLICT, 'picked-screen-active', 'The Active Screen cannot be picked.', { screenId })
    if (isPassedOver({ id: screen.id, isActive: screen.isActive, schedule: screen.schedule, renderSignal: screen.renderSignal }, nextRotationAt(device, new Date())))
      throw new ApiException(HttpStatus.CONFLICT, 'picked-screen-ineligible', 'Rotation could not show that Screen at the next poll.', { screenId })

    // TypeORM's QueryDeepPartialEntity can't infer through Screen's own relations
    // (Plugin's `webhookPayload` union trips it up several levels down) even
    // though `screen` already matches the relation exactly — hence the assertion.
    await this.deviceRepository.update({ id: device.id }, { pickedScreen: screen } as Parameters<typeof this.deviceRepository.update>[1])
    this.logger.log(`Device ${deviceId} picked screen ${screenId}`)
  }

  /** "Back to Order": idempotent, whether or not a pick was set. */
  async clear(deviceId: string): Promise<void> {
    await this.deviceOrRefuse(deviceId)
    await this.deviceRepository.update({ id: deviceId }, { pickedScreen: null })
    this.logger.log(`Device ${deviceId} picked screen cleared`)
  }

  private async deviceOrRefuse(deviceId: string): Promise<Device> {
    const device = isUUID(deviceId) ? await this.deviceRepository.findOneBy({ id: deviceId }) : null
    if (!device)
      throw new ApiException(HttpStatus.NOT_FOUND, 'device-not-found', 'Device not found', { id: deviceId })
    return device
  }

  private async screenOrRefuse(screenId: string): Promise<Screen> {
    const screen = isUUID(screenId)
      ? await this.screenRepository.findOne({ where: { id: screenId }, relations: { device: true, schedule: true } })
      : null
    if (!screen)
      throw new ApiException(HttpStatus.NOT_FOUND, 'screen-not-found', 'Screen not found', { id: screenId })
    return screen
  }
}
