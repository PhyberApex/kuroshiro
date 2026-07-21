import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'
import { ReorderScreensDto } from '../reorder-screens.dto'

describe('reorder-screens dto', () => {
  it('creates dto with screenIds', () => {
    const dto = new ReorderScreensDto()
    dto.screenIds = ['screen-1', 'screen-2']

    expect(dto.screenIds).toEqual(['screen-1', 'screen-2'])
  })

  it('passes validation with a non-empty array of string ids', async () => {
    const dto = new ReorderScreensDto()
    dto.screenIds = ['screen-1', 'screen-2']

    const errors = await validate(dto)

    expect(errors).toHaveLength(0)
  })

  it('fails validation when screenIds is missing', async () => {
    const dto = new ReorderScreensDto()

    const errors = await validate(dto)

    expect(errors.length).toBeGreaterThan(0)
  })

  it('fails validation when screenIds is empty', async () => {
    const dto = new ReorderScreensDto()
    dto.screenIds = []

    const errors = await validate(dto)

    expect(errors.length).toBeGreaterThan(0)
  })

  it('fails validation when screenIds contains non-string entries', async () => {
    const dto = new ReorderScreensDto()
    dto.screenIds = [1, 2] as unknown as string[]

    const errors = await validate(dto)

    expect(errors.length).toBeGreaterThan(0)
  })
})
