import type { DeviceSensorKind } from '../../device-sensors/entities/device-sensor.entity.js'

export interface SensorReadingDto {
  kind: DeviceSensorKind
  value: number
  unit: string
}
