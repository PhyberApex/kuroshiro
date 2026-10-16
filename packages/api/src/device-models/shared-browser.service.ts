import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { closeSharedBrowser } from './shared-browser.js'

/** Closes the shared render browser when the Instance stops (ADR-0044). */
@Injectable()
export class SharedBrowserService implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await closeSharedBrowser()
  }
}
