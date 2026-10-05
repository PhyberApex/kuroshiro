import type { ConfigService } from '@nestjs/config'
import type { DeviceSensorsService } from '../../device-sensors/device-sensors.service.js'
import type { PluginRendererService } from '../../plugins/services/plugin-renderer.service.js'
import type { MockPluginRendererService } from '../../test/mockPluginCollaborators.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockDeviceSensorsService, primeMockDeviceSensorsService } from '../../device-sensors/__test__/mockDeviceSensorsService.js'
import { makeDevice, makeMashupConfiguration, makeMashupSlot, makePlugin, makePluginTemplate } from '../../test/fixtures.js'
import { createMockPluginRendererService, createPluginTemplateContextService } from '../../test/mockPluginCollaborators.js'
import { asService } from '../../test/mockService.js'
import { MashupRendererService } from '../services/mashup-renderer.service.js'

function makeRenderer(pluginRenderer: MockPluginRendererService): MashupRendererService {
  const deviceSensors = createMockDeviceSensorsService()
  primeMockDeviceSensorsService(deviceSensors)

  return new MashupRendererService(
    asService<PluginRendererService>(pluginRenderer),
    asService<ConfigService>({ get: vi.fn().mockReturnValue('http://localhost:3000') }),
    asService<DeviceSensorsService>(deviceSensors),
    createPluginTemplateContextService(),
  )
}

describe('mashup Integration Tests', () => {
  let pluginRenderer: MockPluginRendererService

  beforeEach(() => {
    pluginRenderer = createMockPluginRendererService()
  })

  it('should render mashup HTML with plugin content', async () => {
    pluginRenderer.render = vi.fn()
      .mockResolvedValueOnce('<div class="plugin-weather">Sunny 72°F</div>')
      .mockResolvedValueOnce('<div class="plugin-calendar">Meeting at 2pm</div>')

    const renderer = makeRenderer(pluginRenderer)

    const mockMashupConfig = makeMashupConfiguration({
      id: 'config-1',
      layout: '1Lx1R',
      slots: [
        makeMashupSlot({
          id: 'slot-1',
          position: 'L',
          size: 'view--half_vertical',
          order: 0,
          plugin: makePlugin({
            id: 'plugin-1',
            name: 'Weather Plugin',
            templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '<div>test</div>' })],
          }),
        }),
        makeMashupSlot({
          id: 'slot-2',
          position: 'R',
          size: 'view--half_vertical',
          order: 1,
          plugin: makePlugin({
            id: 'plugin-2',
            name: 'Calendar Plugin',
            templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '<div>test</div>' })],
          }),
        }),
      ],
    })

    const mockDevice = makeDevice({ id: 'device-1', name: 'Test Device', width: 800, height: 480 })

    const html = await renderer.renderMashup(mockMashupConfig, mockDevice)

    expect(html).toContain('class="mashup mashup--1Lx1R"')
    expect(html).toContain('class="plugin-weather"')
    expect(html).toContain('class="plugin-calendar"')
    expect(html).toContain('Sunny 72°F')
    expect(html).toContain('Meeting at 2pm')
  })

  it('renders the other slots with an error placeholder standing in for the one that fails', async () => {
    pluginRenderer.render = vi.fn().mockResolvedValue('<div class="plugin-calendar">Meeting at 2pm</div>')

    const renderer = makeRenderer(pluginRenderer)

    const mockMashupConfig = makeMashupConfiguration({
      id: 'config-1',
      layout: '1Lx1R',
      slots: [
        // A Webhook-kind Plugin with no Template of any size isn't renderable in a Mashup slot — renderSlot throws, falling back to the error placeholder.
        makeMashupSlot({ id: 'slot-1', position: 'L', size: 'view--half_vertical', order: 0, plugin: makePlugin({ id: 'plugin-1', name: 'Weather Plugin', kind: 'Webhook', templates: [] }) }),
        makeMashupSlot({
          id: 'slot-2',
          position: 'R',
          size: 'view--half_vertical',
          order: 1,
          plugin: makePlugin({
            id: 'plugin-2',
            name: 'Calendar Plugin',
            templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '<div>test</div>' })],
          }),
        }),
      ],
    })

    const mockDevice = makeDevice({ id: 'device-1', width: 800, height: 480 })

    const html = await renderer.renderMashup(mockMashupConfig, mockDevice)

    expect(html).toContain('error.png')
    expect(html).toContain('class="plugin-calendar"')
    expect(html).toContain('Meeting at 2pm')
  })
})
