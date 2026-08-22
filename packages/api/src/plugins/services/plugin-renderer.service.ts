import { Injectable } from '@nestjs/common'
import { Liquid } from 'liquidjs'

@Injectable()
export class PluginRendererService {
  private liquid: Liquid

  constructor() {
    this.liquid = new Liquid()
    this.registerCustomFilters()
  }

  private registerCustomFilters() {
    // Date formatting filters
    this.liquid.registerFilter('date_short', (date: unknown) => {
      const d = new Date(date as string | number | Date)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    })

    this.liquid.registerFilter('date_long', (date: unknown) => {
      const d = new Date(date as string | number | Date)
      return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    })

    this.liquid.registerFilter('time_short', (date: unknown) => {
      const d = new Date(date as string | number | Date)
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    })

    // Number formatting
    this.liquid.registerFilter('number_with_delimiter', (num: unknown) => {
      return Number(num).toLocaleString('en-US')
    })

    this.liquid.registerFilter('round', (num: unknown, precision = 0) => {
      return Number(num).toFixed(precision)
    })

    // String helpers
    this.liquid.registerFilter('truncate_words', (text: string, count = 20) => {
      const words = text.split(/\s+/)
      if (words.length <= count)
        return text
      return `${words.slice(0, count).join(' ')}...`
    })

    this.liquid.registerFilter('titleize', (text: string) => {
      return text.split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
      ).join(' ')
    })

    // Array helpers
    this.liquid.registerFilter('shuffle', (arr: unknown[]) => {
      const shuffled = [...arr]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      return shuffled
    })

    this.liquid.registerFilter('sample', (arr: unknown[], count = 1) => {
      const shuffled = [...arr].sort(() => Math.random() - 0.5)
      return count === 1 ? shuffled[0] : shuffled.slice(0, count)
    })

    // Boolean helpers
    this.liquid.registerFilter('yesno', (value: unknown, yes = 'Yes', no = 'No') => {
      return value ? yes : no
    })

    // JSON serialization (used by TRMNL plugins)
    this.liquid.registerFilter('json', (value: unknown) => {
      return JSON.stringify(value)
    })

    // URL encoding
    this.liquid.registerFilter('url_encode', (value: unknown) => {
      return encodeURIComponent(String(value))
    })

    this.liquid.registerFilter('url_decode', (value: unknown) => {
      return decodeURIComponent(String(value))
    })
  }

  async render(template: string, data: object): Promise<string> {
    return this.liquid.parseAndRender(template, data)
  }
}
