export interface Device {
  id: string
  name: string
  friendlyId: string
  mac: string
  apikey: string
  batteryVoltage?: string
  fwVersion?: string
  refreshRate?: number
  rssi?: string
  userAgent?: string
  width?: number
  height?: number
  mirrorEnabled: boolean
  mirrorMac: string
  mirrorApikey: string
  specialFunction: string
  resetDevice: boolean
  updateFirmware: boolean
  lastSeen: string
}
