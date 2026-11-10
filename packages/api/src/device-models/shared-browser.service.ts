import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { closeSharedBrowser, setRenderRequestPolicy } from './shared-browser.js'

/** Guards the shared render browser's requests for this Instance, and closes the browser when the Instance stops (ADR-0044). */
@Injectable()
export class SharedBrowserService implements OnModuleDestroy {
  /** Set before any render, as one may run in another provider's `onModuleInit`. */
  constructor(configService: ConfigService) {
    setRenderRequestPolicy({
      demoMode: configService.getOrThrow<boolean>('demo_mode'),
      apiPort: configService.getOrThrow<number>('port'),
      apiUrl: configService.getOrThrow<string>('api_url'),
    })
  }

  async onModuleDestroy(): Promise<void> {
    await closeSharedBrowser()
  }
}
