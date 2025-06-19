import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '../../plugins/vuetify'
import ScreenPreviewCard from '../ScreenPreviewCard.vue'

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

// Mock formatDate
vi.mock('@/utils/formatDate', () => ({
  formatDate: (date: string) => `formatted: ${date}`,
}))

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

describe('screenPreviewCard', () => {
  beforeEach(() => {
    screensStoreMock = {
      fetchCurrentScreenForDevice: vi.fn(),
      screens: [],
      deleteScreen: vi.fn(),
      updateExternalScreen: vi.fn(),
      currentScreen: {
        filename: 'test.bmp',
        image_url: 'http://example.com/image.bmp',
        refresh_rate: 60,
        rendered_at: '2024-01-01T00:00:00Z',
      },
    }
  })

  it('renders without error and shows image and date', () => {
    const wrapper = mount(ScreenPreviewCard, {
      props: { deviceId: 'device1' },
      global: {
        plugins: [vuetify],
      },
    })
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('[data-test-id="screen-image"]').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'VImg' }).props('src')).toBe('http://example.com/image.bmp')
    expect(wrapper.find('[data-test-id="screen-rendered-date"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="screen-rendered-date"]').text()).toContain('formatted: 2024-01-01T00:00:00Z')
  })

  it('renders non date if renderedAt is empty', () => {
    screensStoreMock.currentScreen.rendered_at = undefined
    const wrapper = mount(ScreenPreviewCard, {
      props: { deviceId: 'device1' },
      global: {
        plugins: [vuetify],
      },
    })
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('[data-test-id="screen-image"]').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'VImg' }).props('src')).toBe('http://example.com/image.bmp')
    expect(wrapper.find('[data-test-id="screen-rendered-date"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="screen-rendered-date"]').text()).toContain('???')
  })

  it('renders default text on screen not available', () => {
    screensStoreMock.currentScreen = undefined
    const wrapper = mount(ScreenPreviewCard, {
      props: { deviceId: 'device1' },
      global: {
        plugins: [vuetify],
      },
    })
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('[data-test-id="no-screen"]').exists()).toBe(true)
  })
})
