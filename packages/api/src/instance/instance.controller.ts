import type { InstanceFacts } from 'kuroshiro-shared'
import { Controller, Get } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { getApiVersion } from '../configuration/get-api-version.js'
import { UPLOAD_LIMITS } from '../uploads/upload-limits.js'
import { toInstanceFacts } from './instance-facts.js'

@Controller('instance')
export class InstanceController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  get(): InstanceFacts {
    return toInstanceFacts({
      version: getApiVersion(),
      serverUrl: this.configService.getOrThrow<string>('api_url'),
      timezone: new Intl.DateTimeFormat().resolvedOptions().timeZone,
      demoMode: this.configService.getOrThrow<boolean>('demo_mode'),
      appriseUrl: this.configService.get<{ appriseUrl?: string }>('alerts')?.appriseUrl,
      limits: UPLOAD_LIMITS,
    })
  }
}
