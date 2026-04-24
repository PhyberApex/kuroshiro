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

globalThis.visualViewport = globalThis.visualViewport || {
  addEventListener: () => {},
  removeEventListener: () => {},
  width: 1024,
  height: 768,
  offsetLeft: 0,
  offsetTop: 0,
  pageLeft: 0,
  pageTop: 0,
  scale: 1,
} as any

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

  it('shows orange Mashup chip for mashup screens', () => {
    screensStoreMock.screens = [
      {
        id: 'mashup1',
        type: 'mashup',
        filename: 'My Dashboard',
        isActive: true,
        device: 'device1',
        fetchManual: false,
        mashupConfiguration: { id: 'config1', layout: '2x2' },
      },
    ]
    const wrapper = mount(ScreenListCard, {
      props: { deviceId: 'device1' },
      global: {
        plugins: [createPinia(), vuetify],
      },
    })
    const chips = wrapper.findAllComponents({ name: 'VChip' })
    const typeChip = chips.find(c => c.text() === 'Mashup')
    expect(typeChip).toBeDefined()
    expect(typeChip?.props('color')).toBe('orange')
  })

  it('shows mashup preview with cached output when available', async () => {
    const cachedHtml = '<div class="mashup-content">test content</div>'
    screensStoreMock.screens = [
      {
        id: 'mashup1',
        type: 'mashup',
        filename: 'My Dashboard',
        isActive: true,
        device: 'device1',
        fetchManual: false,
        mashupConfiguration: { id: 'config1', layout: '2x2' },
        cachedPluginOutput: cachedHtml,
      },
    ]
    const wrapper = mount(ScreenListCard, {
      props: { deviceId: 'device1' },
      global: {
        plugins: [createPinia(), vuetify],
      },
      attachTo: document.body,
    })

    const previewBtn = wrapper.findAll('button').find(b => b.attributes('aria-label') === 'Preview mashup')
    expect(previewBtn).toBeDefined()
    await previewBtn?.trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as any).showScreenPreview).toBe(true)
    expect((wrapper.vm as any).previewMode).toBe('mashup')
    expect((wrapper.vm as any).selectedPreviewScreen.cachedPluginOutput).toBe(cachedHtml)

    wrapper.unmount()
  })

  it('shows info alert when mashup has no cached output', async () => {
    screensStoreMock.screens = [
      {
        id: 'mashup1',
        type: 'mashup',
        filename: 'My Dashboard',
        isActive: true,
        device: 'device1',
        fetchManual: false,
        mashupConfiguration: { id: 'config1', layout: '2x2' },
        cachedPluginOutput: null,
      },
    ]
    const wrapper = mount(ScreenListCard, {
      props: { deviceId: 'device1' },
      global: {
        plugins: [createPinia(), vuetify],
      },
      attachTo: document.body,
    })

    const previewBtn = wrapper.findAll('button').find(b => b.attributes('aria-label') === 'Preview mashup')
    await previewBtn?.trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as any).showScreenPreview).toBe(true)
    expect((wrapper.vm as any).previewMode).toBe('mashup')
    expect((wrapper.vm as any).selectedPreviewScreen.cachedPluginOutput).toBeNull()

    wrapper.unmount()
  })
})
