import buffer from 'node:buffer'
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FirmwareController } from '../firmware.controller'

describe('firmwareController', () => {
  let controller: FirmwareController
  let firmwareService: { findAll: ReturnType<typeof vi.fn>, upload: ReturnType<typeof vi.fn>, delete: ReturnType<typeof vi.fn> }
  let syncService: { sync: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    firmwareService = { findAll: vi.fn(), upload: vi.fn(), delete: vi.fn() }
    syncService = { sync: vi.fn() }
    controller = new FirmwareController(firmwareService as any, syncService as any)
  })

  it('lists firmware', async () => {
    const rows = [{ id: 'fw-1' }]
    firmwareService.findAll.mockResolvedValue(rows)
    await expect(controller.getAll()).resolves.toBe(rows)
  })

  it('returns the sync result', async () => {
    const result = { inserted: true, version: '1.5.6' }
    syncService.sync.mockResolvedValue(result)
    await expect(controller.sync()).resolves.toBe(result)
  })

  it('maps a failed sync to 503', async () => {
    syncService.sync.mockRejectedValue(new Error('TRMNL firmware/latest request failed: 502 Bad Gateway'))
    await expect(controller.sync()).rejects.toThrow(ServiceUnavailableException)
  })

  describe('upload', () => {
    const file = { buffer: buffer.Buffer.from('x'), originalname: 'og.bin', mimetype: 'application/octet-stream', size: 1 } as Express.Multer.File

    it('rejects when no file is provided', async () => {
      await expect(controller.upload(undefined as any, '1.0.0')).rejects.toThrow(BadRequestException)
      expect(firmwareService.upload).not.toHaveBeenCalled()
    })

    it('uploads with an unparsed compatibleModels field', async () => {
      firmwareService.upload.mockResolvedValue({ id: 'fw-1' })
      await controller.upload(file, '1.0.0', 'My Label', '["og_plus","og_bwry"]')
      expect(firmwareService.upload).toHaveBeenCalledWith(file, { version: '1.0.0', label: 'My Label', compatibleModels: ['og_plus', 'og_bwry'] })
    })

    it('rejects an invalid compatibleModels payload', async () => {
      await expect(controller.upload(file, '1.0.0', undefined, 'not-json')).rejects.toThrow(BadRequestException)
      expect(firmwareService.upload).not.toHaveBeenCalled()
    })

    it('rejects a compatibleModels payload that is not a string array', async () => {
      await expect(controller.upload(file, '1.0.0', undefined, '[1,2]')).rejects.toThrow(BadRequestException)
      expect(firmwareService.upload).not.toHaveBeenCalled()
    })
  })

  it('deletes a firmware', async () => {
    await controller.delete('fw-1')
    expect(firmwareService.delete).toHaveBeenCalledWith('fw-1')
  })
})
