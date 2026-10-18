import type { EffectScope } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { effectScope } from 'vue'
import { buildDeviceLogEntry } from '@/testing/fixtures/devices'
import { useDeviceLog } from '../deviceLog'
import { fakeKitchenLog } from './deviceLogHarness'

// The page offers "Older entries" only while there are older entries, and a Device Log the server has no newest entry
// for is empty, which the page reloads by itself: these guards are reached from the composable alone.

let scope: EffectScope | undefined

afterEach(() => scope?.stop())

async function kitchenLog() {
  scope = effectScope()
  const log = scope.run(() => useDeviceLog(() => 'kitchen', () => ({ level: 'all', q: '' })))!
  await expect.poll(() => log.shown).toBeDefined()
  return log
}

describe('a Device Log as the Logs page holds it', () => {
  it('asks for nothing on "Older entries" when there is no older page', async () => {
    const faked = fakeKitchenLog()
    const log = await kitchenLog()
    const reads = faked.reads.length

    expect(await log.loadOlder()).toBeUndefined()
    expect(faked.reads).toHaveLength(reads)
    expect(log.loadingOlder).toBe(false)
  })

  it('loads the first page again for the new entries of a Device Log that had no newest entry', async () => {
    const faked = fakeKitchenLog({ entries: [] })
    const log = await kitchenLog()
    expect(log.shown?.newestCursor).toBeNull()

    faked.entries = [buildDeviceLogEntry({ id: 'new-1', at: '2026-10-03T07:34:00.000Z', message: 'display poll, served Weather (Order 1)' })]
    await log.loadNew()

    expect(faked.reads.at(-1)).toEqual({})
    expect(log.shown?.entries.map(entry => entry.id)).toEqual(['new-1'])
  })
})
