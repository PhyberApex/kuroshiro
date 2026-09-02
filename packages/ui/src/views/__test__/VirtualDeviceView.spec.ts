import type { useDeviceStore } from '@/stores/device'
import type { Device } from '@/types'
import { flushPromises, mount } from '@vue/test-utils'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VAutocomplete, VTextField } from 'vuetify/components'
import vuetify from '@/plugins/vuetify'
import { stubVisualViewport } from '@/test/browser'
import { asStore } from '@/test/mockStore'
import VirtualDeviceView from '../VirtualDeviceView.vue'

globalThis.ResizeObserver = rop
globalThis.visualViewport = globalThis.visualViewport || stubVisualViewport()

globalThis.window.matchMedia = globalThis.window.matchMedia || function () {
  return {
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }
}

vi.mock('vue-router', () => ({
  useRoute: () => ({ name: 'virtualDevice', params: {} }),
}))

let deviceStoreMock: ReturnType<typeof useDeviceStore>
vi.mock('@/stores/device', () => ({
  useDeviceStore: () => deviceStoreMock,
}))

const device: Device = {
  id: 'device-1',
  name: 'Kitchen',
  friendlyId: 'kitchen',
  mac: 'AA:BB:CC:DD:EE:FF',
  apikey: 'key',
  batteryVoltage: '3.9V',
  fwVersion: '1.2.3',
  refreshRate: 900,
  rssi: '-50',
  userAgent: 'device-agent',
  width: 600,
  height: 400,
  reportedModel: 'v2',
  mirrorEnabled: false,
  mirrorMac: '',
  mirrorApikey: '',
  specialFunction: '',
  sleepModeEnabled: false,
  sleepScreenEnabled: false,
  resetDevice: false,
  updateFirmware: false,
  lastSeen: '2026-01-01T00:00:00.000Z',
}

function mountView() {
  return mount(VirtualDeviceView, {
    attachTo: document.body,
    global: { plugins: [vuetify] },
  })
}

function headerValue(wrapper: ReturnType<typeof mountView>, label: string) {
  return wrapper.findAllComponents(VTextField).find(c => c.props('label') === label)?.props('modelValue')
}

describe('virtualDeviceView', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    deviceStoreMock = asStore<ReturnType<typeof useDeviceStore>>({
      devices: [device],
      getById: vi.fn().mockReturnValue(undefined),
    })
  })

  it('fills the device-derived headers when a device is picked from the device tab', async () => {
    const wrapper = mountView()

    await wrapper.get('[value="device"]').trigger('click')
    await flushPromises()
    await wrapper.findComponent(VAutocomplete).vm.$emit('update:modelValue', device.mac)
    await flushPromises()

    expect(headerValue(wrapper, 'battery-voltage')).toBe('3.9V')
    expect(headerValue(wrapper, 'fw-version')).toBe('1.2.3')
    expect(headerValue(wrapper, 'refresh-rate')).toBe('900')
    expect(headerValue(wrapper, 'rssi')).toBe('-50')
    expect(headerValue(wrapper, 'user-agent')).toBe('device-agent')
    expect(headerValue(wrapper, 'width')).toBe('600')
    expect(headerValue(wrapper, 'height')).toBe('400')
    expect(headerValue(wrapper, 'model')).toBe('v2')
  })

  it('keeps the previous header value when the device does not report one', async () => {
    const partialDevice: Device = { ...device, mac: 'FF:EE:DD:CC:BB:AA', batteryVoltage: undefined }
    deviceStoreMock.devices = [partialDevice]
    const wrapper = mountView()

    await wrapper.get('[value="device"]').trigger('click')
    await flushPromises()
    await wrapper.findComponent(VAutocomplete).vm.$emit('update:modelValue', partialDevice.mac)
    await flushPromises()

    expect(headerValue(wrapper, 'battery-voltage')).toBe('4.2V')
  })

  it('does not sync headers while the mac tab is active', async () => {
    const wrapper = mountView()

    await wrapper.findComponent(VTextField).vm.$emit('update:modelValue', device.mac)
    await flushPromises()

    expect(headerValue(wrapper, 'battery-voltage')).toBe('4.2V')
  })
})
