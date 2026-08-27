import type { useDeviceStore } from '@/stores/device'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VAutocomplete, VTabs, VTextField } from 'vuetify/components'
import vuetify from '../../plugins/vuetify'
import { stubVisualViewport } from '../../test/browser'
import { asStore } from '../../test/mockStore'
import VirtualDeviceView from '../VirtualDeviceView.vue'

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

globalThis.visualViewport = globalThis.visualViewport || stubVisualViewport()

vi.mock('vue-router', () => ({
  useRoute: () => ({ name: 'virtualDevice', params: {} }),
}))

let deviceStoreMock: ReturnType<typeof useDeviceStore>
vi.mock('@/stores/device', () => ({
  useDeviceStore: () => deviceStoreMock,
}))

function mountView() {
  return mount(VirtualDeviceView, {
    global: { plugins: [createPinia(), vuetify] },
    attachTo: document.body,
  })
}

function headerField(wrapper: ReturnType<typeof mountView>, label: string) {
  return wrapper.findAllComponents(VTextField).find(field => field.props('label') === label)
}

describe('virtualDeviceView', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    deviceStoreMock = asStore<ReturnType<typeof useDeviceStore>>({
      devices: [{
        id: 'device-1',
        mac: 'AA:BB:CC:DD:EE:FF',
        batteryVoltage: '3.9V',
        fwVersion: '1.2.3',
        refreshRate: 300,
        rssi: '-50',
        userAgent: 'custom-ua',
        width: 800,
        height: 480,
        reportedModel: 'og2',
      }],
    })
  })

  it('fills the custom headers from the selected device when picking it from the device tab', async () => {
    const wrapper = mountView()
    await flushPromises()

    wrapper.findComponent(VTabs).vm.$emit('update:modelValue', 'device')
    await flushPromises()
    wrapper.findComponent(VAutocomplete).vm.$emit('update:modelValue', 'AA:BB:CC:DD:EE:FF')
    await flushPromises()

    expect(headerField(wrapper, 'battery-voltage')?.props('modelValue')).toBe('3.9V')
    expect(headerField(wrapper, 'fw-version')?.props('modelValue')).toBe('1.2.3')
    expect(headerField(wrapper, 'refresh-rate')?.props('modelValue')).toBe('300')
    expect(headerField(wrapper, 'rssi')?.props('modelValue')).toBe('-50')
    expect(headerField(wrapper, 'user-agent')?.props('modelValue')).toBe('custom-ua')
    expect(headerField(wrapper, 'width')?.props('modelValue')).toBe('800')
    expect(headerField(wrapper, 'height')?.props('modelValue')).toBe('480')
    expect(headerField(wrapper, 'model')?.props('modelValue')).toBe('og2')
  })

  it('keeps the current header value when the device does not report that field', async () => {
    deviceStoreMock.devices[0].batteryVoltage = undefined

    const wrapper = mountView()
    await flushPromises()

    wrapper.findComponent(VTabs).vm.$emit('update:modelValue', 'device')
    await flushPromises()
    wrapper.findComponent(VAutocomplete).vm.$emit('update:modelValue', 'AA:BB:CC:DD:EE:FF')
    await flushPromises()

    expect(headerField(wrapper, 'battery-voltage')?.props('modelValue')).toBe('4.2V')
  })
})
