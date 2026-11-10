import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { closeSharedBrowser, setRenderRequestPolicy } from './shared-browser.js'

/** Guards the shared render browser's requests for this Instance, and closes the browser when the Instance stops (ADR-0044). */
@Injectable()
export class SharedBrowserService implements OnModuleDestroy {
  constructor(configService: ConfigService) {
    setRenderRequestPolicy({
      demoMode: configService.get<boolean>('demo_mode') ?? false,
      apiPort: configService.get<number>('port') ?? 3000,
      apiUrl: configService.get<string>('api_url') ?? 'http://localhost:3000',
    })
  }

  async onModuleDestroy(): Promise<void> {
    await closeSharedBrowser()
  }
}
