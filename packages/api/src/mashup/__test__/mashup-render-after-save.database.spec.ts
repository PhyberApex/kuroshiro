import type { ScreenRead } from 'kuroshiro-shared'
import type { DataSource } from 'typeorm'
import type { DeviceModelsService } from '../../device-models/device-models.service.js'
import type { HttpTestApp } from '../../test/httpApp.js'
import type { MashupRendererService } from '../services/mashup-renderer.service.js'
import { ConfigService } from '@nestjs/config'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Alert } from '../../alerts/entities/alert.entity.js'
import { Device } from '../../devices/devices.entity.js'
import { PluginFieldValue } from '../../plugins/entities/plugin-field-value.entity.js'
import { PluginField } from '../../plugins/entities/plugin-field.entity.js'
import { Plugin } from '../../plugins/entities/plugin.entity.js'
import { PluginFieldValuesService } from '../../plugins/services/plugin-field-values.service.js'
import { DeviceScreensController } from '../../screens/device-screens.controller.js'
import { ScreenReadsService } from '../../screens/screen-reads.service.js'
import { Screen } from '../../screens/screens.entity.js'
import { ScreensService } from '../../screens/screens.service.js'
import { createHttpTestApp } from '../../test/httpApp.js'
import { createMockDeviceModelsService, primeMockDeviceModelsService } from '../../test/mockDeviceModelsService.js'
import { asService } from '../../test/mockService.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { MashupConfiguration } from '../entities/mashup-configuration.entity.js'
import { MashupSlot } from '../entities/mashup-slot.entity.js'
import { MashupController } from '../mashup.controller.js'
import { MashupService } from '../mashup.service.js'
import { ScreenRenderService } from '../services/screen-render.service.js'

vi.mock('../../device-models/render-html-to-png.js', () => ({ renderHtmlToPng: vi.fn().mockResolvedValue(null) }))
vi.mock('../../utils/fileExists.js', () => ({ fileExists: vi.fn().mockResolvedValue(true) }))

describe('a Mashup\'s image renders right after its save, against a real database', () => {
  let database: DataSource
  let http: HttpTestApp
  let device: Device
  let pluginA: Plugin
  let pluginB: Plugin
  let mashupRenderer: { renderMashup: ReturnType<typeof vi.fn> }

  beforeAll(async () => {
    database = await createTestDatabase()
    const deviceModels = createMockDeviceModelsService()
    primeMockDeviceModelsService(deviceModels)
    const config = asService<ConfigService>({ get: () => 'http://api' })
    mashupRenderer = { renderMashup: vi.fn() }
    const screenRender = new ScreenRenderService(
      database.getRepository(Screen),
      config,
      asService<DeviceModelsService>(deviceModels),
      asService<MashupRendererService>(mashupRenderer),
    )
    const mashupService = new MashupService(
      database.getRepository(Screen),
      database.getRepository(Device),
      database.getRepository(MashupConfiguration),
      database.getRepository(MashupSlot),
      database.getRepository(Plugin),
      screenRender,
    )
    const fieldValues = new PluginFieldValuesService(database.getRepository(PluginFieldValue), database.getRepository(PluginField))
    const screenReads = new ScreenReadsService(database.getRepository(Screen), database.getRepository(Device), database.getRepository(Alert), fieldValues)

    http = await createHttpTestApp({
      controllers: [MashupController, DeviceScreensController],
      providers: [
        { provide: MashupService, useValue: mashupService },
        { provide: ScreenReadsService, useValue: screenReads },
        { provide: ScreensService, useValue: asService<ScreensService>({}) },
        { provide: ConfigService, useValue: config },
      ],
    })
  })

  beforeEach(async () => {
    mashupRenderer.renderMashup.mockReset().mockResolvedValue('<div class="mashup">rendered</div>')
    await database.getRepository(Plugin).createQueryBuilder().delete().execute()
    await database.getRepository(Device).createQueryBuilder().delete().execute()
    device = await database.getRepository(Device).save({ name: 'Kitchen', friendlyId: 'ABC123', mac: 'AA:BB:CC:DD:EE:01', apikey: 'device-secret', refreshRate: 300 })
    pluginA = await database.getRepository(Plugin).save({ name: 'Weather' })
    pluginB = await database.getRepository(Plugin).save({ name: 'Calendar' })
  })

  afterAll(async () => {
    await http.app.close()
    await database.destroy()
  })

  async function screenReadFor(screenId: string, deviceId: string): Promise<ScreenRead> {
    const response = await http.request(`/api/devices/${deviceId}/screens`)
    expect(response.status).toBe(200)
    const screens: ScreenRead[] = await response.json()
    return screens.find(screen => screen.id === screenId)!
  }

  function patchMashup(screenId: string, pluginIds: string[]): Promise<Response> {
    return http.request(`/api/mashup/${screenId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pluginIds }),
    })
  }

  async function createSettledMashup(): Promise<ScreenRead> {
    const createResponse = await http.postJson('/api/mashup', { deviceId: device.id, name: 'Dashboard', layout: '1Lx1R', pluginIds: [pluginA.id, pluginB.id] })
    expect(createResponse.status).toBe(201)
    const created: ScreenRead = await createResponse.json()
    await vi.waitFor(async () => expect((await screenReadFor(created.id, device.id)).renderedAt).not.toBeNull())
    return screenReadFor(created.id, device.id)
  }

  it('answers the PATCH before its render finishes, then settles into the new image without a /display poll', async () => {
    const before = await createSettledMashup()

    let resolveRender!: (html: string) => void
    mashupRenderer.renderMashup.mockImplementation(() => new Promise<string>((resolve) => {
      resolveRender = resolve
    }))

    const patchResponse = await patchMashup(before.id, [pluginB.id, pluginA.id])
    expect(patchResponse.status).toBe(200)
    const patched: ScreenRead = await patchResponse.json()
    // The render is still pending at this point (resolveRender has not been called), so the
    // PATCH's own answer could not have been built from its output: it carries the pre-render state.
    expect(patched.renderedAt).toBe(before.renderedAt)
    expect(patched.imagePath).toBe(before.imagePath)

    resolveRender('<div class="mashup">changed</div>')

    await vi.waitFor(async () => expect((await screenReadFor(before.id, device.id)).renderedAt).not.toBe(before.renderedAt))
    const after = await screenReadFor(before.id, device.id)
    expect(after.imagePath).not.toBe(before.imagePath)
    expect(Date.parse(after.renderedAt!)).toBeGreaterThan(Date.parse(before.renderedAt!))
  })

  it('leaves the Screen\'s stored image as it was when the background render throws', async () => {
    const before = await createSettledMashup()

    mashupRenderer.renderMashup.mockRejectedValue(new Error('boom'))
    const patchResponse = await patchMashup(before.id, [pluginB.id, pluginA.id])
    expect(patchResponse.status).toBe(200)

    // Give the rejected background render a turn to run and be swallowed.
    await new Promise(resolve => setTimeout(resolve, 10))
    const after = await screenReadFor(before.id, device.id)
    expect(after.renderedAt).toBe(before.renderedAt)
    expect(after.imagePath).toBe(before.imagePath)
  })
})
