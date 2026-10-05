import type { Alert } from '../../alerts/entities/alert.entity.js'
import type { DeviceSensor } from '../../device-sensors/entities/device-sensor.entity.js'
import type { Device } from '../../devices/devices.entity.js'
import type { PluginDataSource } from '../../plugins/entities/plugin-data-source.entity.js'
import { IsNull } from 'typeorm'
import { beforeEach, describe, expect, it } from 'vitest'
import { makeAlert, makeDevice, makeDeviceSensor, makePlugin, makePluginDataSource } from '../../test/fixtures.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { MetricsService } from '../metrics.service.js'

describe('metricsService', () => {
  let deviceRepo: ReturnType<typeof createMockRepository<Device>>
  let alertRepo: ReturnType<typeof createMockRepository<Alert>>
  let sensorRepo: ReturnType<typeof createMockRepository<DeviceSensor>>
  let dataSourceRepo: ReturnType<typeof createMockRepository<PluginDataSource>>
  let service: MetricsService

  beforeEach(() => {
    deviceRepo = createMockRepository<Device>()
    deviceRepo.find.mockResolvedValue([])
    alertRepo = createMockRepository<Alert>()
    alertRepo.find.mockResolvedValue([])
    sensorRepo = createMockRepository<DeviceSensor>()
    sensorRepo.find.mockResolvedValue([])
    dataSourceRepo = createMockRepository<PluginDataSource>()
    dataSourceRepo.find.mockResolvedValue([])
    service = new MetricsService(asRepository(deviceRepo), asRepository(alertRepo), asRepository(sensorRepo), asRepository(dataSourceRepo))
  })

  it('emits a battery and RSSI sample carrying name and friendlyId for a Device that reported both', async () => {
    deviceRepo.find.mockResolvedValue([
      makeDevice({ name: 'Living Room', friendlyId: 'ABC123', batteryVoltage: '3.99', rssi: '-62', lastSeen: new Date('2026-01-01T00:00:00.000Z') }),
    ])

    const text = await service.render()

    expect(text).toContain('kuroshiro_device_battery_volts{device="Living Room",friendly_id="ABC123"} 3.99\n')
    expect(text).toContain('kuroshiro_device_rssi_dbm{device="Living Room",friendly_id="ABC123"} -62\n')
  })

  it('omits the battery sample for a Device whose batteryVoltage is unset', async () => {
    deviceRepo.find.mockResolvedValue([makeDevice({ batteryVoltage: undefined, rssi: '-62' })])

    const text = await service.render()

    expect(text).not.toContain('kuroshiro_device_battery_volts{')
    expect(text).toContain('kuroshiro_device_rssi_dbm{')
  })

  it('omits the RSSI sample for a Device whose rssi is not a number', async () => {
    deviceRepo.find.mockResolvedValue([makeDevice({ batteryVoltage: '3.99', rssi: 'n/a' })])

    const text = await service.render()

    expect(text).toContain('kuroshiro_device_battery_volts{')
    expect(text).not.toContain('kuroshiro_device_rssi_dbm{')
  })

  it('emits a last-seen sample as a Unix timestamp for a Device that polled', async () => {
    deviceRepo.find.mockResolvedValue([makeDevice({ name: 'Living Room', friendlyId: 'ABC123', lastSeen: new Date('2026-01-01T00:00:00.000Z') })])

    const text = await service.render()

    expect(text).toContain('kuroshiro_device_last_seen_timestamp_seconds{device="Living Room",friendly_id="ABC123"} 1767225600\n')
  })

  it('leaves the last-seen sample out for a Device that never polled', async () => {
    deviceRepo.find.mockResolvedValue([
      makeDevice({ name: 'Living Room', friendlyId: 'ABC123', lastSeen: new Date('2026-01-01T00:00:00.000Z') }),
      makeDevice({ name: 'Hallway', friendlyId: 'DEF456', lastSeen: null }),
    ])

    const text = await service.render()

    expect(text).toContain('kuroshiro_device_last_seen_timestamp_seconds{device="Living Room",friendly_id="ABC123"} 1767225600\n')
    expect(text).not.toContain('kuroshiro_device_last_seen_timestamp_seconds{device="Hallway"')
  })

  it('emits one alerts_active sample per known kind, defaulting absent kinds to 0', async () => {
    alertRepo.find.mockResolvedValue([makeAlert({ kind: 'device-offline' }), makeAlert({ kind: 'device-offline' })])

    const text = await service.render()

    expect(text).toContain('kuroshiro_alerts_active{kind="device-offline"} 2\n')
    expect(text).toContain('kuroshiro_alerts_active{kind="device-low-battery"} 0\n')
  })

  it('escapes a Device name containing a quote, backslash and newline in its label', async () => {
    deviceRepo.find.mockResolvedValue([makeDevice({ name: 'Living "Room"\\den\nfloor 2', friendlyId: 'ABC123', batteryVoltage: '3.99' })])

    const text = await service.render()

    expect(text).toContain('device="Living \\"Room\\"\\\\den\\nfloor 2"')
  })

  it('queries only active (unresolved) Alerts', async () => {
    await service.render()

    expect(alertRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { resolvedAt: IsNull() } }))
  })

  it('returns Prometheus text with HELP and TYPE lines for every metric family', async () => {
    const text = await service.render()

    for (const name of [
      'kuroshiro_device_battery_volts',
      'kuroshiro_device_rssi_dbm',
      'kuroshiro_device_last_seen_timestamp_seconds',
      'kuroshiro_alerts_active',
      'kuroshiro_device_sensor_carbon_dioxide_ppm',
      'kuroshiro_device_sensor_humidity_percent',
      'kuroshiro_device_sensor_pressure_hpa',
      'kuroshiro_device_sensor_temperature_celsius',
      'kuroshiro_data_source_fetch_failure_streak',
    ]) {
      expect(text).toContain(`# HELP ${name} `)
      expect(text).toContain(`# TYPE ${name} gauge`)
    }
  })

  it('emits one sensor sample per Sensor kind a Device reports, with correct name, value and labels', async () => {
    const device = makeDevice({ name: 'Living Room', friendlyId: 'ABC123' })
    sensorRepo.find.mockResolvedValue([
      makeDeviceSensor({ kind: 'temperature', value: 21.5, unit: 'C', device }),
      makeDeviceSensor({ kind: 'humidity', value: 45, unit: '%', device }),
      makeDeviceSensor({ kind: 'pressure', value: 1013.25, unit: 'hPa', device }),
      makeDeviceSensor({ kind: 'carbon_dioxide', value: 800, unit: 'ppm', device }),
    ])

    const text = await service.render()

    expect(text).toContain('kuroshiro_device_sensor_temperature_celsius{device="Living Room",friendly_id="ABC123"} 21.5\n')
    expect(text).toContain('kuroshiro_device_sensor_humidity_percent{device="Living Room",friendly_id="ABC123"} 45\n')
    expect(text).toContain('kuroshiro_device_sensor_pressure_hpa{device="Living Room",friendly_id="ABC123"} 1013.25\n')
    expect(text).toContain('kuroshiro_device_sensor_carbon_dioxide_ppm{device="Living Room",friendly_id="ABC123"} 800\n')
  })

  it('emits no sensor samples for a Device with no DeviceSensor rows', async () => {
    const text = await service.render()

    for (const name of ['kuroshiro_device_sensor_carbon_dioxide_ppm', 'kuroshiro_device_sensor_humidity_percent', 'kuroshiro_device_sensor_pressure_hpa', 'kuroshiro_device_sensor_temperature_celsius'])
      expect(text).not.toContain(`${name}{`)
  })

  it('omits a sensor sample when the reported unit differs from the expected one for its kind', async () => {
    sensorRepo.find.mockResolvedValue([makeDeviceSensor({ kind: 'temperature', value: 70, unit: 'F' })])

    const text = await service.render()

    expect(text).not.toContain('kuroshiro_device_sensor_temperature_celsius{')
  })

  it('emits a fetch_failure_streak sample for a fetch-mode Data Source, including a streak of 0', async () => {
    dataSourceRepo.find.mockResolvedValue([
      makePluginDataSource({ name: 'Weather', mode: 'fetch', fetchFailureStreak: 0, plugin: makePlugin({ id: 'plugin-1', name: 'Weather Plugin' }) }),
    ])

    const text = await service.render()

    expect(text).toContain('kuroshiro_data_source_fetch_failure_streak{plugin="Weather Plugin",plugin_id="plugin-1",data_source="Weather"} 0\n')
  })

  it('emits no fetch_failure_streak sample for a literal-mode Data Source', async () => {
    dataSourceRepo.find.mockResolvedValue([makePluginDataSource({ mode: 'literal' })])

    const text = await service.render()

    expect(text).not.toContain('kuroshiro_data_source_fetch_failure_streak{')
  })

  it('disambiguates two Plugins sharing a name and Data Source name via the plugin_id label', async () => {
    dataSourceRepo.find.mockResolvedValue([
      makePluginDataSource({ name: 'Weather', mode: 'fetch', fetchFailureStreak: 1, plugin: makePlugin({ id: 'plugin-1', name: 'Weather Plugin' }) }),
      makePluginDataSource({ name: 'Weather', mode: 'fetch', fetchFailureStreak: 2, plugin: makePlugin({ id: 'plugin-2', name: 'Weather Plugin' }) }),
    ])

    const text = await service.render()

    expect(text).toContain('kuroshiro_data_source_fetch_failure_streak{plugin="Weather Plugin",plugin_id="plugin-1",data_source="Weather"} 1\n')
    expect(text).toContain('kuroshiro_data_source_fetch_failure_streak{plugin="Weather Plugin",plugin_id="plugin-2",data_source="Weather"} 2\n')
  })

  it('escapes a Plugin name containing a quote and a Data Source name containing a backslash in the fetch_failure_streak labels', async () => {
    dataSourceRepo.find.mockResolvedValue([
      makePluginDataSource({ name: 'Feed\\Primary', mode: 'fetch', plugin: makePlugin({ name: 'Weather "Co"' }) }),
    ])

    const text = await service.render()

    expect(text).toContain('plugin="Weather \\"Co\\""')
    expect(text).toContain('data_source="Feed\\\\Primary"')
  })
})
