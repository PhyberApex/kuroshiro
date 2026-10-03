import type { HttpTestApp } from '../../test/httpApp.js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createHttpTestApp } from '../../test/httpApp.js'
import { PluginsController } from '../plugins.controller.js'
import { PluginsService } from '../plugins.service.js'
import { PluginExporterService } from '../services/plugin-exporter.service.js'
import { PluginImporterService } from '../services/plugin-importer.service.js'
import { RecipeUpdateService } from '../services/recipe-update.service.js'

describe('assigning a Plugin to a Device over HTTP', () => {
  let http: HttpTestApp
  const pluginsService = { assignToDevice: vi.fn() }

  beforeAll(async () => {
    http = await createHttpTestApp({
      controllers: [PluginsController],
      providers: [
        { provide: PluginsService, useValue: pluginsService },
        { provide: PluginImporterService, useValue: {} },
        { provide: PluginExporterService, useValue: {} },
        { provide: RecipeUpdateService, useValue: {} },
      ],
    })
  })

  afterAll(async () => {
    await http.app.close()
  })

  it('refuses a body that does not match the DTO', async () => {
    const response = await http.postJson('/api/plugins/plugin-1/assign', { deviceId: 7, pluginId: 'plugin-1' })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      code: 'validation',
      fields: [
        { path: 'pluginId', message: 'property pluginId should not exist' },
        { path: 'deviceId', message: 'deviceId must be a string' },
      ],
    })
    expect(pluginsService.assignToDevice).not.toHaveBeenCalled()
  })

  it('hands a valid body to the service with only the keys that were sent', async () => {
    pluginsService.assignToDevice.mockResolvedValue({ id: 'assignment-1' })

    const response = await http.postJson('/api/plugins/plugin-1/assign', { deviceId: 'device-1' })

    expect(response.status).toBe(201)
    const [, dto] = pluginsService.assignToDevice.mock.calls[0]
    expect(Object.keys(dto)).toEqual(['deviceId'])
  })
})
