import type { DeviceStatusStamp } from '@/types.ts'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import vuetify from '../../plugins/vuetify'
import DeviceLogStatusPanel from '../DeviceLogStatusPanel.vue'

const status: DeviceStatusStamp = {
  wifi_rssi_level: -55,
  battery_voltage: 3.7,
  current_fw_version: '1.2.3',
  free_heap_size: 20480,
  wakeup_reason: 'timer',
  wifi_status: 'connected',
}

describe('deviceLogStatusPanel', () => {
  it('renders every device status field', () => {
    const wrapper = mount(DeviceLogStatusPanel, {
      props: { status },
      global: { plugins: [vuetify] },
    })

    expect(wrapper.text()).toContain('-55 dBm')
    expect(wrapper.text()).toContain('3.7 V')
    expect(wrapper.text()).toContain('1.2.3')
    expect(wrapper.text()).toContain('20.0 KB')
    expect(wrapper.text()).toContain('timer')
    expect(wrapper.text()).toContain('connected')
  })
})
