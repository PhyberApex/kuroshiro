import { Controller, Get } from '@nestjs/common'
import { OutsideAdminApi } from '../errors/outside-admin-api.decorator.js'
import { DeviceHeaders } from './device-headers.decorator.js'
import { SetupRequestHeadersDto } from './dto/setup-request-headers.dto.js'
import { DeviceSetupService } from './setup.service.js'
import 'dotenv/config'

interface SetupResponse {
  status: 200
  image_url: string
  message: string
  api_key: string
  friendly_id: string
}

@Controller('setup')
@OutsideAdminApi()
export class SetupController {
  constructor(
    private readonly deviceSetupService: DeviceSetupService,
  ) {
  }

  @Get()
  async setupDevice(@DeviceHeaders(SetupRequestHeadersDto) headers: SetupRequestHeadersDto): Promise<SetupResponse> {
    return this.deviceSetupService.setupDevice(headers)
  }
}
