import type { NormalizedLogStatus } from '@/types.ts'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import vuetify from '../../plugins/vuetify'
import DeviceLogStatusPanel from '../DeviceLogStatusPanel.vue'

const status: NormalizedLogStatus = {
  wifiRssi: -55,
  batteryVoltage: 3.7,
  firmwareVersion: '1.2.3',
  freeHeapSize: 20480,
  wakeReason: 'timer',
  wifiStatus: 'connected',
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
