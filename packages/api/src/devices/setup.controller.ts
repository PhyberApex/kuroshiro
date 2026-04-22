import type { SetupRequestHeadersDto } from './dto/setup-request-headers.dto'
import { Controller, Get, Headers, UsePipes, ValidationPipe } from '@nestjs/common'
import { DeviceSetupService } from './setup.service'
import 'dotenv/config'

interface SetupResponse {
  status: 200
  image_url: string
  message: string
  api_key: string
  friendly_id: string
}

@Controller('setup')
export class SetupController {
  constructor(
    private readonly deviceSetupService: DeviceSetupService,
  ) {
  }

  @Get()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  async setupDevice(@Headers() headers: SetupRequestHeadersDto): Promise<SetupResponse> {
    return this.deviceSetupService.setupDevice(headers)
  }
}
