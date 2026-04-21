import { describe, expect, it } from 'vitest'
import { CreateDeviceDto } from '../create-device.dto'

describe('create-device dto', () => {
  it('creates dto with mac and name', () => {
    const dto = new CreateDeviceDto()
    dto.mac = '00:11:22:33:44:55'
    dto.name = 'My Device'

    expect(dto.mac).toBe('00:11:22:33:44:55')
    expect(dto.name).toBe('My Device')
  })
})
