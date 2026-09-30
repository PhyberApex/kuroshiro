import type { Alert } from '../../alerts/entities/alert.entity.js'
import type { Device } from '../../devices/devices.entity.js'
import { IsNull } from 'typeorm'
import { beforeEach, describe, expect, it } from 'vitest'
import { makeAlert, makeDevice } from '../../test/fixtures.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { MetricsService } from '../metrics.service.js'

describe('metricsService', () => {
  let deviceRepo: ReturnType<typeof createMockRepository<Device>>
  let alertRepo: ReturnType<typeof createMockRepository<Alert>>
  let service: MetricsService

  beforeEach(() => {
    deviceRepo = createMockRepository<Device>()
    deviceRepo.find.mockResolvedValue([])
    alertRepo = createMockRepository<Alert>()
    alertRepo.find.mockResolvedValue([])
    service = new MetricsService(asRepository(deviceRepo), asRepository(alertRepo))
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

  it('emits a last-seen sample as a Unix timestamp for every Device', async () => {
    deviceRepo.find.mockResolvedValue([makeDevice({ name: 'Living Room', friendlyId: 'ABC123', lastSeen: new Date('2026-01-01T00:00:00.000Z') })])

    const text = await service.render()

    expect(text).toContain('kuroshiro_device_last_seen_timestamp_seconds{device="Living Room",friendly_id="ABC123"} 1767225600\n')
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

  it('returns Prometheus text with HELP and TYPE lines for all four metric families', async () => {
    const text = await service.render()

    for (const name of ['kuroshiro_device_battery_volts', 'kuroshiro_device_rssi_dbm', 'kuroshiro_device_last_seen_timestamp_seconds', 'kuroshiro_alerts_active']) {
      expect(text).toContain(`# HELP ${name} `)
      expect(text).toContain(`# TYPE ${name} gauge`)
    }
  })
})
