import { describe, expect, it } from 'vitest'
import { CreateScreenDto } from '../create-screen.dto'

describe('create-screen dto', () => {
  it('creates dto with filename and deviceId', () => {
    const dto = new CreateScreenDto()
    dto.filename = 'screen.png'
    dto.deviceId = 'device-123'

    expect(dto.filename).toBe('screen.png')
    expect(dto.deviceId).toBe('device-123')
  })

  it('includes optional external link', () => {
    const dto = new CreateScreenDto()
    dto.filename = 'screen.png'
    dto.deviceId = 'device-123'
    dto.externalLink = 'https://example.com/image.png'

    expect(dto.externalLink).toBe('https://example.com/image.png')
  })

  it('includes optional fetchManual and html', () => {
    const dto = new CreateScreenDto()
    dto.filename = 'screen.png'
    dto.deviceId = 'device-123'
    dto.fetchManual = true
    dto.html = '<div>Hello</div>'

    expect(dto.fetchManual).toBe(true)
    expect(dto.html).toBe('<div>Hello</div>')
  })
})
