export const DEVICE_SENSOR_KINDS = ['carbon_dioxide', 'humidity', 'pressure', 'temperature'] as const
export type DeviceSensorKind = typeof DEVICE_SENSOR_KINDS[number]

export interface SensorReading {
  kind: DeviceSensorKind
  value: number
  unit: string
}
