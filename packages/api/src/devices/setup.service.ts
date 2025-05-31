import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
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
    private configService: ConfigService,
  ) {}

  async setupDevice(headers: { id: string }): Promise<SetupResponse> {
    this.logger.log(`Setup request for MAC: ${headers.id}`)
    const baseSetupResponse = {
      status: 200 as const,
      image_url: `${this.configService.get<string>('api_url')}/screens/welcome.bmp`,
      message: 'Welcome to Kuroshiro',
    }
    let friendlyId = generateFriendlyName()
    let apikey = generateApikey()

    const device = await this.deviceRepository.findOneBy({ mac: headers.id })
    if (device) {
      this.logger.log(`Device found for MAC: ${headers.id}, returning existing credentials.`)
      apikey = device.apikey
      friendlyId = device.friendlyId
    }
    else {
      this.logger.log(`No device found for MAC: ${headers.id}, creating new device.`)
      const newDevice = this.deviceRepository.create({ mac: headers.id, friendlyId, apikey, name: friendlyId })
      await this.deviceRepository.save(newDevice)
      this.logger.log(`New device created with id: ${newDevice.id}`)
    }
    const setupResponse: SetupResponse = {
      ...baseSetupResponse,
      friendly_id: friendlyId,
      api_key: apikey,
    }
    this.logger.debug(`Returning setup: ${JSON.stringify(setupResponse)}`)
    return setupResponse
  }
}
