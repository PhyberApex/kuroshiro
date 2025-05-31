import type { Device } from '../types'

export function isDeviceOnline(device: Device) {
  if (!device.refreshRate)
    return false
  const timeDifferenceSeconds = (new Date().getTime() - new Date(device.lastSeen).getTime()) / 1000

  return timeDifferenceSeconds <= device.refreshRate
}
