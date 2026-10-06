import type { DataSource } from 'typeorm'
import type { InstanceSettingsService } from '../../settings/instance-settings.service.js'
import type { NotificationSenderService } from '../notification-sender.service.js'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Device } from '../../devices/devices.entity.js'
import { PluginDataSource } from '../../plugins/entities/plugin-data-source.entity.js'
import { Plugin } from '../../plugins/entities/plugin.entity.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { AlertSweepService } from '../alert-sweep.service.js'
import { Alert } from '../entities/alert.entity.js'

const send = vi.fn<NotificationSenderService['send']>(async () => true)
const sender = { send, isConfigured: () => true } as unknown as NotificationSenderService
const settings = { resolveThresholds: async () => ({ lowBatteryPercent: 20, offlineMultiplier: 3, fetchFailureThreshold: 3 }) } as unknown as InstanceSettingsService

describe('what an Alert keeps of its cause, against a real database', () => {
  let database: DataSource
  let sweep: AlertSweepService

  beforeAll(async () => {
    database = await createTestDatabase()
    sweep = new AlertSweepService(database.getRepository(Alert), database.getRepository(Device), database.getRepository(PluginDataSource), sender, settings)
  })

  beforeEach(async () => {
    await database.getRepository(Alert).createQueryBuilder().delete().execute()
    await database.getRepository(Device).createQueryBuilder().delete().execute()
    await database.getRepository(Plugin).createQueryBuilder().delete().execute()
  })

  afterAll(async () => {
    await database.destroy()
  })

  async function savedSource() {
    const plugin = await database.getRepository(Plugin).save({ name: 'Weather' } as Plugin)
    return database.getRepository(PluginDataSource).save({ name: 'forecast', plugin, mode: 'fetch', fetchFailureStreak: 3, lastFetchError: '503 Service Unavailable' } as PluginDataSource)
  }

  const onlyAlert = () => database.getRepository(Alert).findOneByOrFail({})

  it('reads the streak and the last error a fetch Alert fired with after it resolved', async () => {
    const source = await savedSource()
    await sweep.sweep()
    await database.getRepository(PluginDataSource).update(source.id, { fetchFailureStreak: 0, lastFetchError: null })
    await sweep.sweep()

    const alert = await onlyAlert()
    expect(alert.resolvedAt).not.toBeNull()
    expect(alert.details).toEqual({ streak: 3, lastError: '503 Service Unavailable' })
  })

  it('keeps updating the cause while the Alert fires', async () => {
    const source = await savedSource()
    await sweep.sweep()
    await database.getRepository(PluginDataSource).update(source.id, { fetchFailureStreak: 5, lastFetchError: 'timeout' })
    await sweep.sweep()

    const alert = await onlyAlert()
    expect(alert.resolvedAt).toBeNull()
    expect(alert.details).toEqual({ streak: 5, lastError: 'timeout' })
  })

  it('reads the last battery percent a battery Alert fired at after it resolved', async () => {
    const device = await database.getRepository(Device).save({ name: 'Kitchen', mac: 'AA:BB:CC:DD:EE:01', apikey: 'key-1', friendlyId: 'K1', batteryVoltage: '3.0', lastSeen: new Date() } as Device)
    await sweep.sweep()
    const firedAt = (await onlyAlert()).details
    await database.getRepository(Device).update(device.id, { batteryVoltage: '4.2' })
    await sweep.sweep()

    const alert = await onlyAlert()
    expect(alert.resolvedAt).not.toBeNull()
    expect(firedAt).toEqual({ percent: expect.any(Number) })
    expect(alert.details).toEqual(firedAt)
  })

  it('announces the recovery with the battery as it is now, not the percent the Alert fired at', async () => {
    const device = await database.getRepository(Device).save({ name: 'Kitchen', mac: 'AA:BB:CC:DD:EE:01', apikey: 'key-1', friendlyId: 'K1', batteryVoltage: '3.0', lastSeen: new Date() } as Device)
    await sweep.sweep()
    await database.getRepository(Device).update(device.id, { batteryVoltage: '4.2' })
    await sweep.sweep()

    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Kuroshiro: Kitchen battery recovered', body: 'Kitchen (AA:BB:CC:DD:EE:01) is at 100%.' }))
  })

  it('does not retry a resolution notification once a sender is configured later, for an Alert that resolved with none configured', async () => {
    const unconfiguredSend = vi.fn<NotificationSenderService['send']>(async () => false)
    const unconfigured = { send: unconfiguredSend, isConfigured: () => false } as unknown as NotificationSenderService
    const sweepWithoutSender = new AlertSweepService(database.getRepository(Alert), database.getRepository(Device), database.getRepository(PluginDataSource), unconfigured, settings)
    const device = await database.getRepository(Device).save({ name: 'Kitchen', mac: 'AA:BB:CC:DD:EE:01', apikey: 'key-1', friendlyId: 'K1', batteryVoltage: '3.0', lastSeen: new Date() } as Device)
    await sweepWithoutSender.sweep()
    await database.getRepository(Device).update(device.id, { batteryVoltage: '4.2' })
    await sweepWithoutSender.sweep()

    const resolved = await onlyAlert()
    expect(resolved.resolvedAt).not.toBeNull()
    expect(resolved.resolutionNotifiedAt).not.toBeNull()

    send.mockClear()
    await sweep.sweep() // a sender is now configured

    expect(send).not.toHaveBeenCalled()
  })
})
