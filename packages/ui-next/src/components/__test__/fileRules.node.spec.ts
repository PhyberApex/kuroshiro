import { describe, expect, it } from 'vitest'
import { formatBytes, formatNames, refusalOf } from '../fileRules'

const MEGABYTE = 1024 * 1024
const IMAGES = { accept: ['.png', '.jpg', '.webp'], maxBytes: 10 * MEGABYTE, formats: 'PNG, JPEG or WebP' }

describe('file rules', () => {
  it.for([
    [1, '1 KB'],
    [640 * 1024, '640 KB'],
    [MEGABYTE, '1 MB'],
    [10 * MEGABYTE, '10 MB'],
    [13_002_342, '12.4 MB'],
  ] as const)('reads %i bytes as %s', ([bytes, text]) => {
    expect(formatBytes(bytes)).toBe(text)
  })

  it('names the accepted endings as a choice', () => {
    expect(formatNames(['.zip'])).toBe('ZIP')
    expect(formatNames(['.png', '.jpg'])).toBe('PNG or JPG')
    expect(formatNames(['.png', '.jpg', '.webp'])).toBe('PNG, JPG or WEBP')
  })

  it('takes a file of an accepted type within the limit, whatever the case of its ending', () => {
    expect(refusalOf({ name: 'kitchen.png', size: MEGABYTE }, IMAGES)).toBeUndefined()
    expect(refusalOf({ name: 'KITCHEN.JPG', size: 10 * MEGABYTE }, IMAGES)).toBeUndefined()
  })

  it('refuses a file of another type and names the types it takes', () => {
    expect(refusalOf({ name: 'notes.txt', size: 12 }, IMAGES)).toBe('notes.txt is not a PNG, JPEG or WebP file.')
    expect(refusalOf({ name: 'png', size: 12 }, IMAGES)).toBe('png is not a PNG, JPEG or WebP file.')
  })

  it('refuses a file over the limit and names its size and the limit', () => {
    expect(refusalOf({ name: 'kitchen.png', size: 13_002_342 }, IMAGES))
      .toBe('kitchen.png is 12.4 MB. The largest file allowed is 10 MB.')
  })
})
