import { describe, expect, it } from 'vitest'
import { makeAlert, makeDevice, makePluginDataSource } from '../../test/fixtures.js'
import { toAlertSummary } from '../alert.mapper.js'

describe('toAlertSummary', () => {
  it('shapes a Device-subject Alert with its Device as a reference and the other subjects null', () => {
    const device = makeDevice({ id: 'device-1', name: 'Living Room' })
    const alert = makeAlert({ id: 'alert-active', kind: 'device-offline', device, resolvedAt: null, details: { lastSeen: 'x' } })

    expect(toAlertSummary(alert)).toEqual({
      id: 'alert-active',
      kind: 'device-offline',
      device: { id: 'device-1', name: 'Living Room' },
      plugin: null,
      dataSource: null,
      openedAt: alert.openedAt.toISOString(),
      resolvedAt: null,
      details: { lastSeen: 'x' },
    })
  })

  it('shapes a Data-Source-subject Alert with its Plugin and Data Source as references and device null', () => {
    const dataSource = makePluginDataSource({ id: 'ds-1', name: 'Weather API', plugin: { id: 'plugin-1', name: 'Weather Dashboard' } as never })
    const alert = makeAlert({ id: 'alert-active', kind: 'data-source-fetch-failing', device: undefined, dataSource, details: { streak: 3, lastError: 'timeout' } })

    expect(toAlertSummary(alert)).toEqual({
      id: 'alert-active',
      kind: 'data-source-fetch-failing',
      device: null,
      plugin: { id: 'plugin-1', name: 'Weather Dashboard' },
      dataSource: { id: 'ds-1', name: 'Weather API' },
      openedAt: alert.openedAt.toISOString(),
      resolvedAt: null,
      details: { streak: 3, lastError: 'timeout' },
    })
  })

  it('resolves a resolvedAt and a details-less Alert', () => {
    const device = makeDevice({ id: 'device-1', name: 'Living Room' })
    const alert = makeAlert({ device, resolvedAt: new Date('2026-01-02T00:00:00.000Z'), details: undefined })

    const summary = toAlertSummary(alert)

    expect(summary?.resolvedAt).toBe('2026-01-02T00:00:00.000Z')
    expect(summary?.details).toBeNull()
  })

  it('answers undefined for an Alert whose subject relation is missing (cascade-deleted)', () => {
    const orphan = makeAlert({ device: undefined, dataSource: undefined })

    expect(toAlertSummary(orphan)).toBeUndefined()
  })
})
