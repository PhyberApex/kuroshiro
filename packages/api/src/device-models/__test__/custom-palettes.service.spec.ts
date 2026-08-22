import type { Repository } from 'typeorm'
import type { Palette } from '../entities/palette.entity'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomPalettesService } from '../custom-palettes.service'
import { CUSTOM_PALETTE_FRAMEWORK_CLASSES } from '../entities/palette.entity'

interface MockRepository {
  create: ReturnType<typeof vi.fn>
  save: ReturnType<typeof vi.fn>
  findOneBy: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}

function createMockRepository(): MockRepository {
  return {
    create: vi.fn(entity => entity),
    save: vi.fn(async entity => entity),
    findOneBy: vi.fn(),
    remove: vi.fn(async entity => entity),
  }
}

const validDto = { name: 'My Red', frameworkClass: 'screen--color-3bwr', colors: ['#ff0000', '#ffffff', '#000000'] } as const

describe('customPalettesService', () => {
  let service: CustomPalettesService
  let repo: MockRepository

  beforeEach(() => {
    repo = createMockRepository()
    service = new CustomPalettesService(repo as unknown as Repository<Palette>)
  })

  describe('create', () => {
    it.each(CUSTOM_PALETTE_FRAMEWORK_CLASSES)('creates a custom palette for the %s family', async (frameworkClass) => {
      const result = await service.create({ ...validDto, frameworkClass } as any)
      expect(result.kind).toBe('custom')
      expect(result.frameworkClass).toBe(frameworkClass)
      expect(result.colors).toEqual(validDto.colors)
      expect(result.name).toBe(validDto.name)
    })

    it('generates an opaque id, not derived from name', async () => {
      const result = await service.create({ ...validDto } as any)
      expect(result.id).not.toContain('My Red')
      expect(result.id).toMatch(/^[0-9a-f-]{36}$/)
    })

    it('generates a different id for every call', async () => {
      const a = await service.create({ ...validDto } as any)
      const b = await service.create({ ...validDto } as any)
      expect(a.id).not.toBe(b.id)
    })

    it('fixes grays at 2 and leaves grayscaleBitDepth unset', async () => {
      const result = await service.create({ ...validDto } as any)
      expect(result.grays).toBe(2)
      expect(result.grayscaleBitDepth).toBeNull()
    })

    it('rejects a non-colour frameworkClass', async () => {
      await expect(service.create({ ...validDto, frameworkClass: 'screen--1bit' } as any)).rejects.toThrow(BadRequestException)
      expect(repo.save).not.toHaveBeenCalled()
    })

    it('rejects an unrecognised frameworkClass', async () => {
      await expect(service.create({ ...validDto, frameworkClass: 'not-a-real-family' } as any)).rejects.toThrow(BadRequestException)
    })

    it('rejects an empty colors array', async () => {
      await expect(service.create({ ...validDto, colors: [] } as any)).rejects.toThrow(BadRequestException)
    })

    it('rejects a malformed colour value', async () => {
      await expect(service.create({ ...validDto, colors: ['not-a-hex-color'] } as any)).rejects.toThrow(BadRequestException)
    })

    it('rejects a missing name', async () => {
      await expect(service.create({ ...validDto, name: '' } as any)).rejects.toThrow(BadRequestException)
    })
  })

  describe('delete', () => {
    it('hard-deletes an existing custom palette', async () => {
      const palette = { id: 'abc', kind: 'custom' } as Palette
      repo.findOneBy.mockResolvedValue(palette)
      await service.delete('abc')
      expect(repo.remove).toHaveBeenCalledWith(palette)
    })

    it('404s when the palette does not exist', async () => {
      repo.findOneBy.mockResolvedValue(null)
      await expect(service.delete('nope')).rejects.toThrow(NotFoundException)
      expect(repo.remove).not.toHaveBeenCalled()
    })

    it('rejects deleting an official palette', async () => {
      repo.findOneBy.mockResolvedValue({ id: 'bw', kind: 'official' } as Palette)
      await expect(service.delete('bw')).rejects.toThrow(BadRequestException)
      expect(repo.remove).not.toHaveBeenCalled()
    })
  })
})
