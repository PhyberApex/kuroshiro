import { describe, expect, it } from 'vitest'
import { attachmentDisposition } from '../contentDisposition.js'

describe('attachmentDisposition', () => {
  it('names a plain file in both forms', () => {
    expect(attachmentDisposition('Weather.trmnlp.zip')).toBe('attachment; filename="Weather.trmnlp.zip"; filename*=UTF-8\'\'Weather.trmnlp.zip')
  })

  it('replaces what no file name may hold, so a quote or a backslash cannot end the quoted name', () => {
    expect(attachmentDisposition('a"b\\c/d:e\r\nf.zip')).toBe('attachment; filename="a_b_c_d_e__f.zip"; filename*=UTF-8\'\'a_b_c_d_e__f.zip')
  })

  it('keeps letters outside ASCII in filename* only, and encodes what RFC 5987 does not allow bare', () => {
    expect(attachmentDisposition('Wetter für \'morgen\' (10%).zip')).toBe(
      'attachment; filename="Wetter f_r \'morgen\' (10%).zip"; filename*=UTF-8\'\'Wetter%20f%C3%BCr%20%27morgen%27%20%2810%25%29.zip',
    )
  })
})
