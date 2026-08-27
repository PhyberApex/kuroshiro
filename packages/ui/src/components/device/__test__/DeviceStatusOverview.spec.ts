import type { Device, DeviceModel } from '@/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import vuetify from '@/plugins/vuetify'
import DeviceStatusOverview from '../DeviceStatusOverview.vue'

const OG_PLUS: DeviceModel = {
  name: 'og_plus',
  label: 'TRMNL OG (2-bit)',
  width: 800,
  height: 480,
  colors: 4,
  bitDepth: 2,
  scaleFactor: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  mimeType: 'image/png',
  kind: 'trmnl',
  paletteIds: ['bw', 'gray-4'],
  cssClasses: [],
  cssVariables: {},
  deprecated: false,
}

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

function mountOverview(device: Partial<Device> = {}) {
  return mount(DeviceStatusOverview, {
    props: { device: baseDevice(device) },
    global: { plugins: [vuetify] },
  })
}

describe('deviceStatusOverview', () => {
  it('explains that an unassigned device renders as a TRMNL OG', () => {
    const wrapper = mountOverview()
    const summary = wrapper.find('[data-test-id="device-model-summary"]').text()
    expect(summary).toContain('Not resolved yet')
    expect(summary).toContain('800x480')
    expect(wrapper.findAll('input').map(input => input.element.value)).toContain('ABC123')
  })

  it('shows the assigned model with its dimensions', () => {
    const wrapper = mountOverview({ deviceModel: OG_PLUS })
    expect(wrapper.find('[data-test-id="device-model-summary"]').text()).toContain('TRMNL OG (2-bit) (800x480)')
  })

  it('flags a mismatch only when the reported panel size differs from the assigned model', () => {
    expect(mountOverview({ deviceModel: OG_PLUS, width: 800, height: 480 }).find('[data-test-id="device-model-mismatch"]').exists()).toBe(false)
    expect(mountOverview({ deviceModel: OG_PLUS, width: 1872, height: 1404 }).find('[data-test-id="device-model-mismatch"]').exists()).toBe(true)
  })

  it('shows the reported summary line only when present', () => {
    expect(mountOverview().text()).not.toContain('Reported:')
    expect(mountOverview({ reportedModel: 'x', width: 1872, height: 1404 }).text()).toContain('Reported: x · 1872x1404')
  })

  it('shows N/A for rssi and battery when unreported', () => {
    const wrapper = mountOverview()
    expect(wrapper.text()).toContain('N/A')
  })

  it('shows the battery percentage derived from voltage', () => {
    const wrapper = mountOverview({ batteryVoltage: '4.2' })
    expect(wrapper.text()).toContain('(100 %)')
  })

  it('shows the rssi reading in dBm', () => {
    const wrapper = mountOverview({ rssi: '-65' })
    expect(wrapper.text()).toContain('(-65 dBm)')
  })

  it('hides the API key by default and reveals it on toggle', async () => {
    const wrapper = mountOverview()
    const apikeyInput = wrapper.findAll('input').find(input => input.element.value === 'super-secret')!
    expect(apikeyInput.attributes('type')).toBe('password')

    await wrapper.find('[aria-label="API key appended action"]').trigger('click')
    expect(apikeyInput.attributes('type')).toBe('text')
  })
})
