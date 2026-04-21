import { describe, expect, it } from 'vitest'
import { UpdateDeviceDto } from '../update-device.dto'

describe('update-device dto', () => {
  it('creates dto with name', () => {
    const dto = new UpdateDeviceDto()
    dto.name = 'Updated Name'

    expect(dto.name).toBe('Updated Name')
  })

  it('includes optional device info fields', () => {
    const dto = new UpdateDeviceDto()
    dto.batteryVoltage = '3.7V'
    dto.fwVersion = '1.0.0'
    dto.rssi = '-60'
    dto.width = 800
    dto.height = 480

    expect(dto.batteryVoltage).toBe('3.7V')
    expect(dto.fwVersion).toBe('1.0.0')
    expect(dto.rssi).toBe('-60')
    expect(dto.width).toBe(800)
    expect(dto.height).toBe(480)
  })

  it('includes mirror configuration fields', () => {
    const dto = new UpdateDeviceDto()
    dto.mirrorEnabled = true
    dto.mirrorMac = '00:11:22:33:44:55'
    dto.mirrorApikey = 'secret-key'

    expect(dto.mirrorEnabled).toBe(true)
    expect(dto.mirrorMac).toBe('00:11:22:33:44:55')
    expect(dto.mirrorApikey).toBe('secret-key')
  })

  it('includes special function fields', () => {
    const dto = new UpdateDeviceDto()
    dto.specialFunction = 'identify'
    dto.resetDevice = true
    dto.updateFirmware = false

    expect(dto.specialFunction).toBe('identify')
    expect(dto.resetDevice).toBe(true)
    expect(dto.updateFirmware).toBe(false)
  })
})
