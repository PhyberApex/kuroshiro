import { describe, expect, it } from 'vitest'
import { AssignPluginToDeviceDto } from '../assign-plugin-to-device.dto'

describe('assign-plugin-to-device dto', () => {
  it('creates dto with device id', () => {
    const dto = new AssignPluginToDeviceDto()
    dto.deviceId = 'device-123'
    dto.isActive = true
    dto.order = 1

    expect(dto.deviceId).toBe('device-123')
    expect(dto.isActive).toBe(true)
    expect(dto.order).toBe(1)
  })

  it('includes field values', () => {
    const dto = new AssignPluginToDeviceDto()
    dto.fieldValues = [
      { fieldId: 'field-1', value: 'test-value' },
    ]

    expect(dto.fieldValues).toHaveLength(1)
    expect(dto.fieldValues?.[0].fieldId).toBe('field-1')
  })

  it('allows optional isActive', () => {
    const dto = new AssignPluginToDeviceDto()
    dto.deviceId = 'device-123'

    expect(dto.isActive).toBeUndefined()
  })
})
