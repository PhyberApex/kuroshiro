import { Injectable } from '@nestjs/common'
import { renderLiquid } from 'kuroshiro-shared'
import { InstanceTimeZone } from '../../instance/instance-time-zone.js'

@Injectable()
export class PluginRendererService {
  constructor(private readonly instanceTimeZone: InstanceTimeZone) {}

  /** Every server render of a Template, dates in the Instance Time Zone. */
  render(template: string, data: object): Promise<string> {
    return renderLiquid(template, data, { timeZone: this.instanceTimeZone.name })
  }
}
