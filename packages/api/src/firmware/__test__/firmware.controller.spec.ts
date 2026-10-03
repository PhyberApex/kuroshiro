import type { FirmwareReadsService } from '../firmware-reads.service.js'
import type { FirmwareSyncService } from '../firmware-sync.service.js'
import type { FirmwareService } from '../firmware.service.js'
import buffer from 'node:buffer'
import { BadRequestException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeMulterFile } from '../../test/fs.js'
import { asService } from '../../test/mockService.js'
import { FirmwareController } from '../firmware.controller.js'

describe('firmwareController', () => {
  let controller: FirmwareController
  let firmwareService: { upload: ReturnType<typeof vi.fn>, delete: ReturnType<typeof vi.fn> }
  let reads: { list: ReturnType<typeof vi.fn>, readById: ReturnType<typeof vi.fn> }
  let syncService: { sync: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    firmwareService = { upload: vi.fn(), delete: vi.fn() }
    reads = { list: vi.fn(), readById: vi.fn() }
    syncService = { sync: vi.fn() }
    controller = new FirmwareController(asService<FirmwareService>(firmwareService), asService<FirmwareReadsService>(reads), asService<FirmwareSyncService>(syncService))
  })

  it('lists firmware', async () => {
    const list = { lastSync: null, firmware: [] }
    reads.list.mockResolvedValue(list)
    await expect(controller.getAll()).resolves.toBe(list)
  })

  it('returns the sync result', async () => {
    const result = { ranAt: '2026-10-03T04:00:00.000Z', inserted: false, version: '1.5.6', assigned: [] }
    syncService.sync.mockResolvedValue(result)
    await expect(controller.sync()).resolves.toBe(result)
  })

  it('maps a failed sync to 502 upstream-unreachable', async () => {
    syncService.sync.mockRejectedValue(new Error('TRMNL firmware/latest request failed: 502 Bad Gateway'))
    await expect(controller.sync()).rejects.toMatchObject({ code: 'upstream-unreachable', status: 502 })
  })

  describe('upload', () => {
    const file = makeMulterFile({ buffer: buffer.Buffer.from('x'), originalname: 'og.bin', mimetype: 'application/octet-stream', size: 1 })

    it('rejects when no file is provided', async () => {
      await expect(controller.upload(undefined, { version: '1.0.0' })).rejects.toThrow(BadRequestException)
      expect(firmwareService.upload).not.toHaveBeenCalled()
    })

    it('answers the stored Firmware as a read model', async () => {
      const read = { id: 'fw-1' }
      firmwareService.upload.mockResolvedValue({ id: 'fw-1' })
      reads.readById.mockResolvedValue(read)

      await expect(controller.upload(file, { version: '1.0.0' })).resolves.toBe(read)
      expect(firmwareService.upload).toHaveBeenCalledWith(file, { version: '1.0.0' })
      expect(reads.readById).toHaveBeenCalledWith('fw-1')
    })
  })

  it('deletes a firmware', async () => {
    await controller.delete('fw-1')
    expect(firmwareService.delete).toHaveBeenCalledWith('fw-1')
  })
})
