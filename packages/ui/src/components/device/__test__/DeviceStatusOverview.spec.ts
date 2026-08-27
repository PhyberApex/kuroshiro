import type { Device } from '@/types'
import { mdiSignalCellular3 } from '@mdi/js'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import vuetify from '@/plugins/vuetify'
import DeviceStatusOverview from '../DeviceStatusOverview.vue'

function baseDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: 'device1',
    name: 'Test Device',
    friendlyId: 'ABC123',
    mac: 'AA:BB:CC:DD:EE:FF',
    apikey: 'super-secret',
    mirrorEnabled: false,
    mirrorMac: '',
    mirrorApikey: '',
    specialFunction: '',
    sleepModeEnabled: false,
    sleepScreenEnabled: false,
    resetDevice: false,
    updateFirmware: false,
    lastSeen: '',
    ...overrides,
  }
}

function mountOverview(props: Partial<InstanceType<typeof DeviceStatusOverview>['$props']> = {}) {
  return mount(DeviceStatusOverview, {
    props: {
      device: baseDevice(),
      rssiColor: 'success',
      rssiIcon: mdiSignalCellular3,
      batteryColor: 'success',
      batteryIcon: mdiSignalCellular3,
      batteryPercentage: 80,
      modelSummary: 'TRMNL OG (800x480)',
      reportedSummary: null,
      reportMismatch: false,
      ...props,
    },
    global: { plugins: [vuetify] },
  })
}

describe('deviceStatusOverview', () => {
  it('shows the model summary and friendly id/mac/apikey fields', () => {
    const wrapper = mountOverview()
    expect(wrapper.find('[data-test-id="device-model-summary"]').text()).toContain('TRMNL OG (800x480)')
    expect(wrapper.findAll('input').map(input => input.element.value)).toContain('ABC123')
  })

  it('flags a mismatch only when reportMismatch is true', () => {
    expect(mountOverview().find('[data-test-id="device-model-mismatch"]').exists()).toBe(false)
    expect(mountOverview({ reportMismatch: true }).find('[data-test-id="device-model-mismatch"]').exists()).toBe(true)
  })

  it('shows the reported summary line only when present', () => {
    expect(mountOverview().text()).not.toContain('Reported:')
    expect(mountOverview({ reportedSummary: 'x · 1872x1404' }).text()).toContain('Reported: x · 1872x1404')
  })

  it('hides the API key by default and reveals it on toggle', async () => {
    const wrapper = mountOverview()
    const apikeyInput = wrapper.findAll('input').find(input => input.element.value === 'super-secret')!
    expect(apikeyInput.attributes('type')).toBe('password')

    await wrapper.find('[aria-label="API key appended action"]').trigger('click')
    expect(apikeyInput.attributes('type')).toBe('text')
  })
})
