import { describe, expect, it } from 'vitest'
import { makeDevice, makeFirmware } from '../../test/fixtures.js'
import { toFirmwareList, toFirmwareRead } from '../firmware.mapper.js'

describe('the Firmware read model', () => {
  it('names every key, with absent times and label as null', () => {
    const read = toFirmwareRead(makeFirmware({ id: 'fw-1', version: '1.5.0', compatibleModels: ['og_plus'] }), { filePresent: true, targetedBy: [], runningOn: [] })

    expect(JSON.parse(JSON.stringify(read))).toEqual({
      id: 'fw-1',
      version: '1.5.0',
      kind: 'official-synced',
      label: null,
      compatibleModels: ['og_plus'],
      deprecated: false,
      syncedAt: null,
      uploadedAt: null,
      filePresent: true,
      targetOf: [],
      runningOn: [],
    })
  })

  it('serializes times as ISO strings and Devices as id and name, with the push pending of a target', () => {
    const firmware = makeFirmware({ kind: 'custom', label: 'Mine', uploadedAt: new Date('2026-09-30T08:00:00.000Z') })
    const pending = makeDevice({ id: 'd1', name: 'Hallway', apikey: 'secret', updateFirmware: true })
    const runner = makeDevice({ id: 'd2', name: 'Kitchen', apikey: 'secret' })

    const read = toFirmwareRead(firmware, { filePresent: false, targetedBy: [pending], runningOn: [runner] })

    expect(read).toMatchObject({
      label: 'Mine',
      uploadedAt: '2026-09-30T08:00:00.000Z',
      filePresent: false,
      targetOf: [{ id: 'd1', name: 'Hallway', pushPending: true }],
      runningOn: [{ id: 'd2', name: 'Kitchen' }],
    })
    expect(read.targetOf[0]).not.toHaveProperty('apikey')
  })

  it('wraps the list with the last sync as a read model, or null before the first', () => {
    expect(toFirmwareList(null, [])).toEqual({ lastSync: null, firmware: [] })
    expect(toFirmwareList({ kind: 'firmware', ranAt: new Date('2026-10-01T04:00:00.000Z'), ok: false, error: 'timed out' }, []))
      .toEqual({ lastSync: { ranAt: '2026-10-01T04:00:00.000Z', ok: false, error: 'timed out' }, firmware: [] })
  })
})
