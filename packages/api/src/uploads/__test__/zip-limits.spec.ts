import { Buffer } from 'node:buffer'
import AdmZip from 'adm-zip'
import { describe, expect, it } from 'vitest'
import { ApiException } from '../../errors/api.exception.js'
import { declaringSize } from '../../test/zip.js'
import { assertUnpacksWithin } from '../zip-limits.js'

function zipOf(files: Record<string, Buffer>): Buffer {
  const zip = new AdmZip()
  Object.entries(files).forEach(([name, content]) => zip.addFile(name, content))
  return zip.toBuffer()
}

function refusal(zip: Buffer, limitBytes: number): unknown {
  try {
    assertUnpacksWithin(new AdmZip(zip), limitBytes)
  }
  catch (error) {
    return error instanceof ApiException ? { status: error.getStatus(), code: error.code, message: error.message, details: error.details } : error
  }
  return null
}

describe('assertUnpacksWithin', () => {
  it('lets through a zip that unpacks to exactly the limit', () => {
    expect(refusal(zipOf({ 'a.txt': Buffer.alloc(600), 'b.txt': Buffer.alloc(424) }), 1024)).toBeNull()
  })

  it('refuses with 413 zip-unpacks-too-large a zip of zeros that unpacks past the limit, though it is far smaller packed', () => {
    const zip = zipOf({ 'zeros.bin': Buffer.alloc(64 * 1024) })
    expect(zip.length).toBeLessThan(1024)
    expect(refusal(zip, 1024)).toEqual({
      status: 413,
      code: 'zip-unpacks-too-large',
      message: 'The .zip unpacks to more than 1024 bytes.',
      details: { limitBytes: 1024 },
    })
  })

  it('adds up every entry, so many entries under the limit cannot pass together', () => {
    expect(refusal(zipOf({ 'a.txt': Buffer.alloc(600), 'b.txt': Buffer.alloc(425) }), 1024)).toMatchObject({ code: 'zip-unpacks-too-large' })
  })

  it('goes by the size an entry declares, which is what adm-zip inflates it up to', () => {
    const zip = declaringSize(zipOf({ 'settings.yml': Buffer.from('name: x') }), 'settings.yml', 0xFFFF_FFF0)
    expect(refusal(zip, 25 * 1024 * 1024)).toMatchObject({ code: 'zip-unpacks-too-large' })
  })

  it('counts a stored entry at its packed length, which adm-zip copies whatever size it declares', () => {
    const zip = new AdmZip()
    zip.addFile('photo.png', Buffer.alloc(2048, 7))
    zip.getEntry('photo.png')!.header.method = 0
    expect(refusal(declaringSize(zip.toBuffer(), 'photo.png', 0), 1024)).toMatchObject({ code: 'zip-unpacks-too-large' })
  })
})
