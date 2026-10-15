import type { InstanceFacts } from 'kuroshiro-shared'
import { Controller, Get } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { getApiVersion } from '../configuration/get-api-version.js'
import { UPLOAD_LIMITS } from '../uploads/upload-limits.js'
import { toInstanceFacts } from './instance-facts.js'
import { InstanceTimeZone } from './instance-time-zone.js'

@Controller('instance')
export class InstanceController {
  constructor(
    private readonly configService: ConfigService,
    private readonly instanceTimeZone: InstanceTimeZone,
  ) {}

  @Get()
  get(): InstanceFacts {
    return toInstanceFacts({
      version: getApiVersion(),
      serverUrl: this.configService.getOrThrow<string>('api_url'),
      timezone: this.instanceTimeZone.name,
      demoMode: this.configService.getOrThrow<boolean>('demo_mode'),
      appriseUrl: this.configService.get<{ appriseUrl?: string }>('alerts')?.appriseUrl,
      limits: UPLOAD_LIMITS,
    })
  }
}
