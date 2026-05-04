import type { Device } from '../types'

export function isDeviceOnline(device: Device) {
  if (!device.refreshRate)
    return false
  const timeDifferenceSeconds = (Date.now() - new Date(device.lastSeen).getTime()) / 1000

  return timeDifferenceSeconds <= device.refreshRate
}
