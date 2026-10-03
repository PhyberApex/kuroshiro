import type { SetupRequestHeadersDto } from './dto/setup-request-headers.dto.js'
import { Controller, Get, Headers } from '@nestjs/common'
import { OutsideAdminApi } from '../errors/outside-admin-api.decorator.js'
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
  async setupDevice(@Headers() headers: SetupRequestHeadersDto): Promise<SetupResponse> {
    return this.deviceSetupService.setupDevice(headers)
  }
}
