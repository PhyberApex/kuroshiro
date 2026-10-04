import type { HttpTestApp } from '../../test/httpApp.js'
import { NotFoundException, UnauthorizedException } from '@nestjs/common'
import { getRepositoryToken } from '@nestjs/typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DisplayController } from '../../devices/display.controller.js'
import { DeviceDisplayService } from '../../devices/display.service.js'
import { SetupController } from '../../devices/setup.controller.js'
import { DeviceSetupService } from '../../devices/setup.service.js'
import { LogsController } from '../../logs/logs.controller.js'
import { LogsService } from '../../logs/logs.service.js'
import { MetricsController } from '../../metrics/metrics.controller.js'
import { MetricsService } from '../../metrics/metrics.service.js'
import { Plugin } from '../../plugins/entities/plugin.entity.js'
import { WebhookPluginGuard } from '../../plugins/guards/webhook-plugin.guard.js'
import { WebhookIngestService } from '../../plugins/services/webhook-ingest.service.js'
import { WebhookIngestController } from '../../plugins/webhook-ingest.controller.js'
import { makePlugin } from '../../test/fixtures.js'
import { createHttpTestApp } from '../../test/httpApp.js'

const display = {
  filename: 'file.png',
  firmware_url: '',
  image_url: 'url',
  refresh_rate: 60,
  reset_firmware: false,
  special_function: 'identify',
  update_firmware: false,
}

const setup = { status: 200, image_url: 'url', message: 'Welcome', api_key: 'key', friendly_id: 'friendly' }

const firmwareHeaders = {
  'id': '2d:34:e2:27:5b:46',
  'access-token': 'token',
  'battery-voltage': '4.1',
  'fw-version': '1.7.8',
  'refresh-rate': '900',
  'rssi': '-60',
  'x-not-declared-anywhere': 'still fine',
}

describe('the endpoints outside the admin API behind the global pipe and filter', () => {
  let http: HttpTestApp
  const displayService = { getCurrentImage: vi.fn(), getCurrentImageWithoutProgressing: vi.fn() }
  const setupService = { setupDevice: vi.fn() }
  const logsService = { addLogToDevice: vi.fn() }
  const ingestService = { ingest: vi.fn(), readPayload: vi.fn() }
  const pluginRepository = { findOne: vi.fn() }
  const metricsService = { render: vi.fn() }

  beforeAll(async () => {
    http = await createHttpTestApp({
      controllers: [DisplayController, SetupController, LogsController, WebhookIngestController, MetricsController],
      providers: [
        { provide: DeviceDisplayService, useValue: displayService },
        { provide: DeviceSetupService, useValue: setupService },
        { provide: LogsService, useValue: logsService },
        { provide: WebhookIngestService, useValue: ingestService },
        { provide: MetricsService, useValue: metricsService },
        { provide: getRepositoryToken(Plugin), useValue: pluginRepository },
        WebhookPluginGuard,
      ],
    })
  })

  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterAll(async () => {
    await http.app.close()
  })

  it('answers /api/display whatever headers the firmware sends', async () => {
    displayService.getCurrentImage.mockResolvedValue(display)

    const response = await http.request('/api/display', { headers: firmwareHeaders })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(display)
    expect(displayService.getCurrentImage).toHaveBeenCalledWith(expect.objectContaining(firmwareHeaders))
  })

  it.each([
    ['an unknown Device', new NotFoundException('Device not found'), { statusCode: 404, message: 'Device not found', error: 'Not Found' }],
    ['a wrong API key', new UnauthorizedException('Invalid API key'), { statusCode: 401, message: 'Invalid API key', error: 'Unauthorized' }],
  ])('refuses /api/display for %s in Nest\'s default body', async (_case, thrown, body) => {
    displayService.getCurrentImage.mockRejectedValue(thrown)

    const response = await http.request('/api/display', { headers: firmwareHeaders })

    expect(response.status).toBe(body.statusCode)
    expect(await response.json()).toEqual(body)
  })

  it('answers /api/current_screen as before', async () => {
    displayService.getCurrentImageWithoutProgressing.mockResolvedValue(display)

    const response = await http.request('/api/current_screen', { headers: firmwareHeaders })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(display)
  })

  it('answers /api/setup as before', async () => {
    setupService.setupDevice.mockResolvedValue(setup)

    const response = await http.request('/api/setup', { headers: { 'id': '2d:34:e2:27:5b:46', 'fw-version': '1.7.8', 'model': 'og' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(setup)
  })

  it('answers an unexpected failure of a Device-facing route in Nest\'s default body', async () => {
    setupService.setupDevice.mockRejectedValue(new Error('boom'))

    const response = await http.request('/api/setup', { headers: { id: '2d:34:e2:27:5b:46' } })

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ statusCode: 500, message: 'Internal server error' })
  })

  it.each([
    ['logs', { logs: [{ id: 1, message: 'boot', wifi_signal: -60, anything: { the: 'firmware adds' } }] }],
    ['log.logs_array', { log: { logs_array: [{ log_id: 2, free_heap_size: 1234, retry: 3 }] } }],
  ])('takes a /api/log body in the %s envelope with entry fields no DTO declares', async (_envelope, body) => {
    const response = await http.postJson('/api/log', body, { headers: { id: '2d:34:e2:27:5b:46' } })

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
    expect(logsService.addLogToDevice).toHaveBeenCalledWith('2d:34:e2:27:5b:46', body)
  })

  it('refuses a /api/log body that is no log envelope in Nest\'s default body', async () => {
    const response = await http.postJson('/api/log', { entries: [] }, { headers: { id: '2d:34:e2:27:5b:46' } })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: [
        'property entries should not exist',
        'Body must be either { logs: [...] } or { log: { logs_array: [...] } }, with each entry a JSON object',
      ],
    })
    expect(logsService.addLogToDevice).not.toHaveBeenCalled()
  })

  it('hands a Webhook body to the ingest untouched', async () => {
    const plugin = makePlugin({ id: 'plugin-1', kind: 'Webhook', webhookToken: 'token-abc' })
    pluginRepository.findOne.mockResolvedValue(plugin)
    ingestService.ingest.mockResolvedValue({ ok: true })
    const body = { merge_variables: { readings: [1, 2], nested: { free: 'form' } }, merge_strategy: 'stream' }

    const response = await http.postJson('/api/webhook/token-abc', body)

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ ok: true })
    expect(ingestService.ingest).toHaveBeenCalledWith(plugin, body)
  })

  it('refuses an unknown Webhook token in Nest\'s default body', async () => {
    pluginRepository.findOne.mockResolvedValue(null)

    const response = await http.postJson('/api/webhook/nope', {})

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ statusCode: 401, message: 'Invalid webhook token', error: 'Unauthorized' })
  })

  it('answers a failed /metrics scrape in Nest\'s default body', async () => {
    metricsService.render.mockRejectedValue(new Error('boom'))

    const response = await http.request('/metrics')

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ statusCode: 500, message: 'Internal server error' })
  })
})
