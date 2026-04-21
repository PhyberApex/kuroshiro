import { describe, expect, it } from 'vitest'
import { DevicePlugin } from '../entities/device-plugin.entity'

describe('device-plugin entity', () => {
  it('creates device plugin with required fields', () => {
    const devicePlugin = new DevicePlugin()
    devicePlugin.id = 'dp-1'
    devicePlugin.isActive = true
    devicePlugin.order = 1

    expect(devicePlugin.id).toBe('dp-1')
    expect(devicePlugin.isActive).toBe(true)
    expect(devicePlugin.order).toBe(1)
  })

  it('has relationships to device and plugin', () => {
    const devicePlugin = new DevicePlugin()
    expect(devicePlugin.device).toBeUndefined()
    expect(devicePlugin.plugin).toBeUndefined()
  })

  it('has isActive and order fields', () => {
    const devicePlugin = new DevicePlugin()
    devicePlugin.isActive = false
    devicePlugin.order = 5

    expect(devicePlugin.isActive).toBe(false)
    expect(devicePlugin.order).toBe(5)
  })
})
