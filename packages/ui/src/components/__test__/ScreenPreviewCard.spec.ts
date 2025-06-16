import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
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

describe('screenPreviewCard', () => {
  it('renders without error and shows image and date', () => {
    const screen = {
      filename: 'test.bmp',
      image_url: 'http://example.com/image.bmp',
      refresh_rate: 60,
      rendered_at: '2024-01-01T00:00:00Z',
    }
    const wrapper = mount(ScreenPreviewCard, {
      props: { screen },
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
})
