import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { describe, expect, it, vi } from 'vitest'
import vuetify from '../../plugins/vuetify'
import AddScreenCard from '../AddScreenCard.vue'

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

// Mock the screens store
vi.mock('@/stores/screens', () => ({
  useScreensStore: () => ({
    addScreen: vi.fn(),
    addScreenFile: vi.fn(),
    addScreenHtml: vi.fn(),
  }),
}))
// Mock the device store
vi.mock('@/stores/device', () => ({
  useDeviceStore: () => ({
    getById: vi.fn(() => ({ id: 'device1', width: 800, height: 480 })),
  }),
}))
// Mock useDemoInfo
vi.mock('@/composeables/useDemoInfo', () => ({
  useDemoInfo: () => ({ isDemo: false }),
}))

describe('addScreenCard', () => {
  it('renders without error and shows filename input', () => {
    const wrapper = mount(AddScreenCard, {
      props: { deviceId: 'device1' },
      global: {
        plugins: [createPinia(), vuetify],
      },
    })
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('[data-test-id="filename-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="add-screen-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="tab-link"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="tab-file"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="tab-html"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="add-screen-btn"]').text()).toContain('Add Screen')
  })
})
