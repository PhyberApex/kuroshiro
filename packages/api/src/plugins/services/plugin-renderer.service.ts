import { Injectable } from '@nestjs/common'
import { renderLiquid } from 'kuroshiro-shared'

@Injectable()
export class PluginRendererService {
  render(template: string, data: object): Promise<string> {
    return renderLiquid(template, data)
  }
}
