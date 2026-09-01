import type { Firmware } from '../entities/firmware.entity.js'
import nodeBuffer from 'node:buffer'
import * as crypto from 'node:crypto'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeFirmware } from '../../test/fixtures.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { asService } from '../../test/mockService.js'
import { FirmwareService } from '../firmware.service.js'

const { fsMock, fileExistsMock } = vi.hoisted(() => ({
  fsMock: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
  fileExistsMock: vi.fn(),
}))

vi.mock('node:fs', () => ({
  promises: fsMock,
}))

vi.mock('../../utils/fileExists.js', () => ({
  fileExists: fileExistsMock,
}))

describe('firmwareService', () => {
  let service: FirmwareService
  let repo: ReturnType<typeof createMockRepository<Firmware>> & {
    queryBuilder: { orderBy: ReturnType<typeof vi.fn>, getMany: ReturnType<typeof vi.fn> }
    createQueryBuilder: ReturnType<typeof vi.fn>
  }
  let configService: { get: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.resetAllMocks()
    fsMock.mkdir.mockResolvedValue(undefined)
    fsMock.writeFile.mockResolvedValue(undefined)
    fsMock.unlink.mockResolvedValue(undefined)

    const queryBuilder = {
      orderBy: vi.fn(),
      getMany: vi.fn(),
    }
    queryBuilder.orderBy.mockReturnValue(queryBuilder)

    repo = {
      ...createMockRepository<Firmware>(),
      queryBuilder,
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    }

    configService = { get: vi.fn().mockReturnValue('http://api') }
    service = new FirmwareService(asRepository(repo), asService(configService))
  })

  describe('upload', () => {
    const file = { buffer: nodeBuffer.Buffer.from('binary-content'), originalname: 'og.bin', mimetype: 'application/octet-stream', size: 14 }

    it('computes and stores a correct checksum', async () => {
      const result = await service.upload(file, { version: '1.0.0' })

      const expectedChecksum = crypto.createHash('sha256').update(file.buffer).digest('hex')
      expect(result.checksum).toBe(expectedChecksum)
      expect(result.kind).toBe('custom')
      expect(result.version).toBe('1.0.0')
      expect(fsMock.writeFile).toHaveBeenCalledWith(expect.stringContaining('.bin'), file.buffer)
    })

    it('defaults the label to the original filename and compatibleModels to empty', async () => {
      const result = await service.upload(file, { version: '1.0.0' })

      expect(result.label).toBe('og.bin')
      expect(result.compatibleModels).toEqual([])
    })

    it('rejects a file over the size limit', async () => {
      await expect(service.upload({ ...file, size: 999_999_999 }, { version: '1.0.0' })).rejects.toThrow(BadRequestException)
      expect(repo.save).not.toHaveBeenCalled()
    })

    it('rejects a file that is not a .bin', async () => {
      await expect(service.upload({ ...file, originalname: 'og.zip' }, { version: '1.0.0' })).rejects.toThrow(BadRequestException)
      expect(repo.save).not.toHaveBeenCalled()
    })

    it('rejects a missing version', async () => {
      await expect(service.upload(file, { version: '' })).rejects.toThrow(BadRequestException)
      expect(repo.save).not.toHaveBeenCalled()
    })
  })

  describe('delete', () => {
    it('deletes a custom firmware', async () => {
      const firmware = makeFirmware({ id: 'fw-1', kind: 'custom' })
      repo.findOneBy.mockResolvedValue(firmware)

      await service.delete('fw-1')

      expect(repo.remove).toHaveBeenCalledWith(firmware)
      expect(fsMock.unlink).toHaveBeenCalledWith(expect.stringContaining('fw-1.bin'))
    })

    it('refuses to delete an official-synced firmware', async () => {
      repo.findOneBy.mockResolvedValue(makeFirmware({ id: 'fw-1', kind: 'official-synced' }))
      await expect(service.delete('fw-1')).rejects.toThrow(BadRequestException)
      expect(repo.remove).not.toHaveBeenCalled()
    })

    it('throws NotFoundException for an unknown id', async () => {
      repo.findOneBy.mockResolvedValue(null)
      await expect(service.delete('nope')).rejects.toThrow(NotFoundException)
    })
  })

  describe('findAll / findById', () => {
    it('lists firmware ordered by most recent first, coalescing uploadedAt and syncedAt', async () => {
      const rows = [makeFirmware({ id: 'fw-1' })]
      repo.queryBuilder.getMany.mockResolvedValue(rows)
      await expect(service.findAll()).resolves.toBe(rows)
      expect(repo.queryBuilder.orderBy).toHaveBeenCalledWith('COALESCE(firmware.uploadedAt, firmware.syncedAt)', 'DESC')
    })

    it('finds a firmware by id', async () => {
      const firmware = makeFirmware({ id: 'fw-1' })
      repo.findOneBy.mockResolvedValue(firmware)
      await expect(service.findById('fw-1')).resolves.toBe(firmware)
    })
  })

  describe('verifyChecksum', () => {
    it('returns true when the on-disk checksum matches', async () => {
      const fileBuffer = nodeBuffer.Buffer.from('binary-content')
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex')
      fileExistsMock.mockResolvedValue(true)
      fsMock.readFile.mockResolvedValue(fileBuffer)

      await expect(service.verifyChecksum(makeFirmware({ id: 'fw-1', checksum }))).resolves.toBe(true)
    })

    it('returns false when the on-disk checksum does not match', async () => {
      fileExistsMock.mockResolvedValue(true)
      fsMock.readFile.mockResolvedValue(nodeBuffer.Buffer.from('corrupted'))

      await expect(service.verifyChecksum(makeFirmware({ id: 'fw-1', checksum: 'deadbeef' }))).resolves.toBe(false)
    })

    it('returns false when the binary is missing on disk', async () => {
      fileExistsMock.mockResolvedValue(false)
      await expect(service.verifyChecksum(makeFirmware({ id: 'fw-1', checksum: 'deadbeef' }))).resolves.toBe(false)
      expect(fsMock.readFile).not.toHaveBeenCalled()
    })
  })

  describe('fileUrl', () => {
    it('builds the url from api_url and the firmware id', () => {
      expect(service.fileUrl('fw-1')).toBe('http://api/firmware/fw-1.bin')
    })
  })
})
