import { Injectable, Logger } from '@nestjs/common'
import { PluginRendererService } from './plugin-renderer.service'

@Injectable()
export class PluginDataFetcherService {
  private readonly logger = new Logger(PluginDataFetcherService.name)

  constructor(private readonly renderer: PluginRendererService) {}

  async fetchData(
    method: string,
    url: string,
    headers: Record<string, string> = {},
    body?: Record<string, any>,
    templateContext?: Record<string, any>,
  ): Promise<any> {
    let resolvedUrl = url

    // If URL contains Liquid template syntax, render it first
    if (url.includes('{{') || url.includes('{%')) {
      this.logger.debug(`Rendering URL template: ${url}`)
      resolvedUrl = await this.renderer.render(url, templateContext || {})
      this.logger.debug(`Resolved URL: ${resolvedUrl}`)
    }

    const options: RequestInit = {
      method,
      headers: method === 'POST' && body
        ? { 'Content-Type': 'application/json', ...headers }
        : headers,
    }

    if (method === 'POST' && body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(resolvedUrl, options)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
  }
}
