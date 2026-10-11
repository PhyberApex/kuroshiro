import { describe, expect, it } from 'vitest'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildPluginDetail, buildPluginPlace } from '@/testing/fixtures/plugins'
import { shootPluginPage } from './__test__/pluginPageHarness'

const devices = [
  buildDeviceSummary({ id: 'hallway', name: 'Hallway' }),
  buildDeviceSummary({ id: 'kitchen', name: 'Kitchen' }),
  buildDeviceSummary({ id: 'study', name: 'Study' }),
]

const weather = buildPluginDetail({
  id: 'weather',
  assignments: [
    { deviceId: 'kitchen', deviceName: 'Kitchen', screenId: 'weather-on-kitchen', order: 2, screenCount: 6, state: 'active' },
    { deviceId: 'hallway', deviceName: 'Hallway', screenId: 'weather-on-hallway', order: 1, screenCount: 2, state: 'scheduleOff' },
  ],
  mashups: [buildPluginPlace({ screenId: 'weekend-board', name: 'Weekend board', deviceId: 'kitchen', deviceName: 'Kitchen' })],
})

describe('the Devices of a Plugin', () => {
  it('on two of three Devices, one Screen active and one with its Schedule off, and in a Mashup', async () => {
    await shootPluginPage('plugin-devices', {
      at: '/plugins/weather',
      plugin: weather,
      shell: { devices },
      assert: async (screen) => {
        await expect.element(screen.getByRole('button', { name: 'Assign to Study' })).toBeVisible()
        await expect.element(screen.getByRole('link', { name: 'Open the Mashup' })).toBeVisible()
      },
    })
  })
})
