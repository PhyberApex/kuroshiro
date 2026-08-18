import type { SetupRequestHeadersDto } from './dto/setup-request-headers.dto'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { DeviceModelsService } from '../device-models/device-models.service'
import { FallbackScreensService } from '../device-models/fallback-screens.service'
import generateApikey from '../utils/generateApikey'
import generateFriendlyName from '../utils/generateFriendlyName'
import { Device } from './devices.entity'

interface SetupResponse {
  status: 200
  image_url: string
  message: string
  api_key: string
  friendly_id: string
}

@Injectable()
export class DeviceSetupService {
  private readonly logger = new Logger(DeviceSetupService.name)
  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    private deviceModels: DeviceModelsService,
    private fallbackScreens: FallbackScreensService,
  ) {}

  async setupDevice(headers: SetupRequestHeadersDto): Promise<SetupResponse> {
    this.logger.log(`Setup request for MAC: ${headers.id}`)
    const existing = await this.deviceRepository.findOneBy({ mac: headers.id })
    const device = existing ?? this.createDevice(headers.id)
    this.logger.log(existing
      ? `Device found for MAC: ${headers.id}, returning existing credentials.`
      : `No device found for MAC: ${headers.id}, creating new device.`)

    device.fwVersion = headers['fw-version'] ?? device.fwVersion
    device.reportedModel = headers.model ?? device.reportedModel
    if (!device.deviceModel)
      await this.deviceModels.assignResolvedModel(device)
    await this.deviceRepository.save(device)
    if (!existing)
      this.logger.log(`New device created with id: ${device.id}`)

    const setupResponse: SetupResponse = {
      status: 200,
      image_url: await this.fallbackScreens.urlFor('welcome', await this.deviceModels.renderTargetFor(device)),
      message: 'Welcome to Kuroshiro',
      friendly_id: device.friendlyId,
      api_key: device.apikey,
    }
    this.logger.debug(`Returning setup: ${JSON.stringify(setupResponse)}`)
    return setupResponse
  }

  private createDevice(mac: string): Device {
    const friendlyId = generateFriendlyName()
    return this.deviceRepository.create({ mac, friendlyId, apikey: generateApikey(), name: friendlyId })
  }
}
