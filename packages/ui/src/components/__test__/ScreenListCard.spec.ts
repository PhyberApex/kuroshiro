import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '../../plugins/vuetify'
import ScreenListCard from '../ScreenListCard.vue'

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

// Use a local variable to control the mock return value
let screensStoreMock: any
vi.mock('@/stores/screens', () => ({
  useScreensStore: () => screensStoreMock,
}))
// Mock the device store
vi.mock('@/stores/device', () => ({
  useDeviceStore: () => ({
    getById: vi.fn(() => ({ id: 'device1', width: 800, height: 480 })),
  }),
}))

describe('screenListCard', () => {
  beforeEach(() => {
    screensStoreMock = {
      screens: [],
      deleteScreen: vi.fn(),
      updateExternalScreen: vi.fn(),
    }
  })

  it('renders without error and shows empty state', () => {
    const wrapper = mount(ScreenListCard, {
      props: { deviceId: 'device1' },
      global: {
        plugins: [createPinia(), vuetify],
      },
    })
    expect(wrapper.find('[data-test-id="screen-empty-alert"]').exists()).toBe(true)
  })

  it('renders table and delete button when screens exist', () => {
    screensStoreMock.screens = [
      { id: 'screen1', filename: 'file1', externalLink: null, isActive: true, device: 'device1', fetchManual: false, html: '' },
      { id: 'screen2', filename: 'file2', externalLink: null, isActive: false, device: 'device1', fetchManual: false, html: '' },
    ]
    const wrapper = mount(ScreenListCard, {
      props: { deviceId: 'device1' },
      global: {
        plugins: [createPinia(), vuetify],
      },
    })
    expect(wrapper.find('[data-test-id="screen-table"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="screen-delete-btn-screen1"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="screen-delete-btn-screen2"]').exists()).toBe(true)
  })
})
