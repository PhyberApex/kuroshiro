import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import vuetify from '../../plugins/vuetify'
import DeviceInformationCard from '../DeviceInformationCard.vue'

// Mock the device store
vi.mock('@/stores/device', () => ({
  useDeviceStore: () => ({
    getById: vi.fn(() => ({
      id: 'device1',
      name: 'Test Device',
      mac: 'AA:BB:CC:DD:EE:FF',
      apikey: 'apikey',
      mirrorEnabled: false,
      mirrorMac: '',
      mirrorApikey: '',
      specialFunction: '',
      resetDevice: false,
      updateFirmware: false,
      lastSeen: '',
    })),
    deleteDevice: vi.fn(),
  }),
}))

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
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

describe('deviceInformationCard', () => {
  it('renders without error and shows device name', () => {
    const wrapper = mount(DeviceInformationCard, {
      props: { deviceId: 'device1' },
      global: {
        plugins: [createPinia(), vuetify],
        mocks: {
          $router: { push: vi.fn() },
        },
      },
    })
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('[data-test-id="device-name"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="device-name"]').text()).toContain('Test Device')
    expect(wrapper.find('[data-test-id="device-mac"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="device-mac"]').text()).toContain('AA:BB:CC:DD:EE:FF')
    expect(wrapper.find('[data-test-id="delete-device-btn"]').exists()).toBe(true)
  })
})
