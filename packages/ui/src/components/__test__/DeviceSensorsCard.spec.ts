import type { useDeviceSensorsStore } from '@/stores/deviceSensors'
import type { SensorReading } from '@/types.ts'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '../../plugins/vuetify'
import { asStore } from '../../test/mockStore'
import DeviceSensorsCard from '../DeviceSensorsCard.vue'

globalThis.ResizeObserver = rop

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

let deviceSensorsStoreMock: ReturnType<typeof useDeviceSensorsStore>
vi.mock('@/stores/deviceSensors', () => ({
  useDeviceSensorsStore: () => deviceSensorsStoreMock,
}))
vi.mock('@/stores/device', () => ({
  useDeviceStore: () => ({
    getById: vi.fn(() => ({ id: 'device1', width: 800, height: 480 })),
  }),
}))

describe('deviceSensorsCard', () => {
  beforeEach(() => {
    deviceSensorsStoreMock = asStore<ReturnType<typeof useDeviceSensorsStore>>({
      error: '',
      readings: [] as SensorReading[],
      loading: false,
    })
  })

  it('renders nothing when the device has no current readings', () => {
    const wrapper = mount(DeviceSensorsCard, {
      props: { deviceId: 'device1' },
      global: {
        plugins: [createPinia(), vuetify],
      },
    })
    expect(wrapper.find('[data-test-id="sensors-list"]').exists()).toBe(false)
    expect(wrapper.html()).toBe('<!--v-if-->')
  })

  it('renders one row per reading with a human label and value/unit', () => {
    deviceSensorsStoreMock.readings = [
      { kind: 'temperature', value: 21.5, unit: '°C' },
      { kind: 'carbon_dioxide', value: 800, unit: 'ppm' },
    ]
    const wrapper = mount(DeviceSensorsCard, {
      props: { deviceId: 'device1' },
      global: {
        plugins: [createPinia(), vuetify],
      },
    })
    const items = wrapper.find('[data-test-id="sensors-list"]').findAll('[data-test-id="sensor-list-item"]')
    expect(items.length).toBe(2)
    expect(items[0].text()).toContain('Temperature')
    expect(items[0].text()).toContain('21.5')
    expect(items[0].text()).toContain('°C')
    expect(items[1].text()).toContain('CO₂')
    expect(items[1].text()).toContain('800')
    expect(items[1].text()).toContain('ppm')
  })
})
