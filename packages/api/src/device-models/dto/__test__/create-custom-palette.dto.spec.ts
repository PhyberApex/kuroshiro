import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'
import { CreateCustomPaletteDto } from '../create-custom-palette.dto'

async function rejectedFields(dto: object): Promise<string[]> {
  const errors = await validate(dto)
  return errors.map(error => error.property)
}

describe('create-custom-palette dto', () => {
  it('accepts a well-formed custom palette', async () => {
    const dto = plainToInstance(CreateCustomPaletteDto, {
      name: 'My Red',
      frameworkClass: 'screen--color-3bwr',
      colors: ['#ff0000', '#ffffff', '#000000'],
    })
    await expect(rejectedFields(dto)).resolves.toEqual([])
  })

  it('rejects a missing name', async () => {
    const dto = plainToInstance(CreateCustomPaletteDto, { frameworkClass: 'screen--color-3bwr', colors: ['#ff0000'] })
    await expect(rejectedFields(dto)).resolves.toEqual(['name'])
  })

  it('rejects a grayscale or full-color frameworkClass', async () => {
    const dto = plainToInstance(CreateCustomPaletteDto, { name: 'x', frameworkClass: 'screen--1bit', colors: ['#ff0000'] })
    await expect(rejectedFields(dto)).resolves.toEqual(['frameworkClass'])
  })

  it('rejects an empty colors array', async () => {
    const dto = plainToInstance(CreateCustomPaletteDto, { name: 'x', frameworkClass: 'screen--color-3bwr', colors: [] })
    await expect(rejectedFields(dto)).resolves.toEqual(['colors'])
  })

  it('rejects a non-hex colour value', async () => {
    const dto = plainToInstance(CreateCustomPaletteDto, { name: 'x', frameworkClass: 'screen--color-3bwr', colors: ['red'] })
    await expect(rejectedFields(dto)).resolves.toEqual(['colors'])
  })
})
