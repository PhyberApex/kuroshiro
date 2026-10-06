import type { Response } from 'express'
import type { DevicePreviewService } from '../device-preview.service.js'
import { Buffer } from 'node:buffer'
import { describe, expect, it, vi } from 'vitest'
import { asService } from '../../test/mockService.js'
import { DevicePreviewController } from '../device-preview.controller.js'

function buildController(render: ReturnType<typeof vi.fn>) {
  return new DevicePreviewController(asService<DevicePreviewService>({ render }))
}

describe('devicePreviewController', () => {
  it('sends the PNG with the Render Signal header, reporting none when no signal was raised', async () => {
    const render = vi.fn().mockResolvedValue({ buffer: Buffer.from('png'), signal: 'none' })
    const controller = buildController(render)
    const res = asService<Response>({ setHeader: vi.fn(), send: vi.fn() })
    const body = { html: '<div>Hi</div>', deviceModelName: 'og_plus', paletteId: 'bw' }

    await controller.render(body, res)

    expect(render).toHaveBeenCalledWith(body)
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png')
    expect(res.setHeader).toHaveBeenCalledWith('X-Render-Signal', 'none')
    expect(res.send).toHaveBeenCalledWith(Buffer.from('png'))
  })

  it('reports the signal the render raised', async () => {
    const render = vi.fn().mockResolvedValue({ buffer: Buffer.from('png'), signal: 'skip' })
    const controller = buildController(render)
    const res = asService<Response>({ setHeader: vi.fn(), send: vi.fn() })

    await controller.render({ html: '<div/>', deviceModelName: 'og_plus', paletteId: 'bw' }, res)

    expect(res.setHeader).toHaveBeenCalledWith('X-Render-Signal', 'skip')
  })
})
