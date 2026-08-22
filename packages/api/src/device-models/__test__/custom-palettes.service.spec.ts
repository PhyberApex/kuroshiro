import type { Palette } from '../entities/palette.entity'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it } from 'vitest'
import { makePalette } from '../../test/fixtures'
import { asRepository, createMockRepository } from '../../test/mockRepository'
import { CustomPalettesService } from '../custom-palettes.service'
import { CUSTOM_PALETTE_FRAMEWORK_CLASSES } from '../entities/palette.entity'

const validDto = { name: 'My Red', frameworkClass: 'screen--color-3bwr' as const, colors: ['#ff0000', '#ffffff', '#000000'] }

describe('customPalettesService', () => {
  let service: CustomPalettesService
  let repo: ReturnType<typeof createMockRepository<Palette>>

  beforeEach(() => {
    repo = createMockRepository<Palette>()
    service = new CustomPalettesService(asRepository(repo))
  })

  describe('create', () => {
    it.each(CUSTOM_PALETTE_FRAMEWORK_CLASSES)('creates a custom palette for the %s family', async (frameworkClass) => {
      const result = await service.create({ ...validDto, frameworkClass })
      expect(result.kind).toBe('custom')
      expect(result.frameworkClass).toBe(frameworkClass)
      expect(result.colors).toEqual(validDto.colors)
      expect(result.name).toBe(validDto.name)
    })

    it('generates an opaque id, not derived from name', async () => {
      const result = await service.create({ ...validDto })
      expect(result.id).not.toContain('My Red')
      expect(result.id).toMatch(/^[0-9a-f-]{36}$/)
    })

    it('generates a different id for every call', async () => {
      const a = await service.create({ ...validDto })
      const b = await service.create({ ...validDto })
      expect(a.id).not.toBe(b.id)
    })

    it('fixes grays at 2 and leaves grayscaleBitDepth unset', async () => {
      const result = await service.create({ ...validDto })
      expect(result.grays).toBe(2)
      expect(result.grayscaleBitDepth).toBeNull()
    })

    it('rejects a non-colour frameworkClass', async () => {
      // @ts-expect-error 'screen--1bit' is not a custom-palette frameworkClass
      await expect(service.create({ ...validDto, frameworkClass: 'screen--1bit' })).rejects.toThrow(BadRequestException)
      expect(repo.save).not.toHaveBeenCalled()
    })

    it('rejects an unrecognised frameworkClass', async () => {
      // @ts-expect-error not a real frameworkClass at all
      await expect(service.create({ ...validDto, frameworkClass: 'not-a-real-family' })).rejects.toThrow(BadRequestException)
    })

    it('rejects an empty colors array', async () => {
      await expect(service.create({ ...validDto, colors: [] })).rejects.toThrow(BadRequestException)
    })

    it('rejects a malformed colour value', async () => {
      await expect(service.create({ ...validDto, colors: ['not-a-hex-color'] })).rejects.toThrow(BadRequestException)
    })

    it('rejects a missing name', async () => {
      await expect(service.create({ ...validDto, name: '' })).rejects.toThrow(BadRequestException)
    })
  })

  describe('delete', () => {
    it('hard-deletes an existing custom palette', async () => {
      const palette = makePalette({ id: 'abc', kind: 'custom' })
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
      repo.findOneBy.mockResolvedValue(makePalette({ id: 'bw', kind: 'official' }))
      await expect(service.delete('bw')).rejects.toThrow(BadRequestException)
      expect(repo.remove).not.toHaveBeenCalled()
    })
  })
})
