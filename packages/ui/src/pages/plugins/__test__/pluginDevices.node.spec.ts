import type { PluginAssignmentRead, ScreenState } from 'kuroshiro-shared'
import { describe, expect, it } from 'vitest'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { assignedStanding, notAssignedSentence, standingsOf, unassignWording } from '../pluginDevices'

function assignment(overrides: Partial<PluginAssignmentRead> = {}): PluginAssignmentRead {
  return {
    deviceId: 'kitchen',
    deviceName: 'Kitchen',
    screenId: 'screen',
    order: 2,
    screenCount: 6,
    state: null,
    ...overrides,
  }
}

describe('the Devices section of the Plugin page', () => {
  it('pairs every Device with the Plugin\'s assignment there, in the Devices\' order', () => {
    const devices = [
      buildDeviceSummary({ id: 'hallway', name: 'Hallway' }),
      buildDeviceSummary({ id: 'kitchen', name: 'Kitchen' }),
      buildDeviceSummary({ id: 'study', name: 'Study' }),
    ]
    const onKitchen = assignment()

    expect(standingsOf(devices, [onKitchen]).map(({ device, assignment }) => [device.name, assignment])).toEqual([
      ['Hallway', undefined],
      ['Kitchen', onKitchen],
      ['Study', undefined],
    ])
  })

  it.each<[ScreenState | null, string]>([
    [null, 'Order 2 of 6'],
    ['active', 'Order 2 of 6 · Active Screen'],
    ['scheduleOff', 'Order 2 of 6 · Schedule off'],
    ['upNext', 'Order 2 of 6'],
    ['notToday', 'Order 2 of 6'],
    ['notThisHour', 'Order 2 of 6'],
    ['skipping', 'Order 2 of 6'],
  ])('words where an assigned Screen in the state %s stands', (state, words) => {
    expect(assignedStanding(assignment({ state }))).toBe(words)
  })

  it('says what unassigning loses and keeps, with the Webhook URL for a Webhook-kind Plugin', () => {
    expect(unassignWording({ name: 'Weather', kind: 'Poll' }, 'Kitchen')).toEqual({
      title: 'Unassign Weather from Kitchen?',
      lost: 'This Screen on Kitchen and its Schedule.',
      stays: 'The Plugin Weather, with its template, its Data Sources and its place in any Mashup.',
    })
    expect(unassignWording({ name: 'Doorbell', kind: 'Webhook' }, 'Hallway').stays)
      .toBe('The Plugin Doorbell, with its template, its Webhook URL and its place in any Mashup.')
  })

  it('says why an assign failed after "Not assigned", when it knows', () => {
    expect(notAssignedSentence('Kuroshiro\'s server is not answering.')).toBe('Not assigned. Kuroshiro\'s server is not answering.')
    expect(notAssignedSentence()).toBe('Not assigned.')
  })
})
