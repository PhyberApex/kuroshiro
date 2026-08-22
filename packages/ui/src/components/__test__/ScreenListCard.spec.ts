import { flushPromises, mount } from '@vue/test-utils'
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
      reorderScreens: vi.fn(),
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

  it('cache-busts the image preview src with the screen generatedAt', async () => {
    screensStoreMock.screens = [
      { id: 'screen1', filename: 'file1', externalLink: null, isActive: true, device: 'device1', fetchManual: false, html: '', generatedAt: '2024-01-01T00:00:00Z' },
    ]
    const wrapper = mount(ScreenListCard, {
      props: { deviceId: 'device1' },
      global: {
        plugins: [createPinia(), vuetify],
      },
      attachTo: document.body,
    })

    const previewBtn = wrapper.findAll('button').find(b => b.attributes('aria-label') === 'Preview screen')
    expect(previewBtn).toBeDefined()
    await previewBtn?.trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as any).showScreenPreview).toBe(true)
    expect((wrapper.vm as any).previewMode).toBe('image')

    const img = document.body.querySelector('img[alt="Screen preview"]')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe(`/screens/devices/device1/screen1.png?v=${encodeURIComponent('2024-01-01T00:00:00Z')}`)

    wrapper.unmount()
  })

  it('moving a screen down with the button calls reorderScreens with the swapped id order', async () => {
    screensStoreMock.screens = [
      { id: 'screen1', filename: 'file1', externalLink: null, isActive: true, device: 'device1', fetchManual: false, html: '' },
      { id: 'screen2', filename: 'file2', externalLink: null, isActive: false, device: 'device1', fetchManual: false, html: '' },
    ]
    screensStoreMock.reorderScreens.mockResolvedValue(undefined)
    const wrapper = mount(ScreenListCard, {
      props: { deviceId: 'device1' },
      global: {
        plugins: [createPinia(), vuetify],
      },
    })

    await wrapper.find('[data-test-id="screen-move-down-screen1"]').trigger('click')

    expect(screensStoreMock.reorderScreens).toHaveBeenCalledWith('device1', ['screen2', 'screen1'])
  })

  it('the up button is disabled for the first row and the down button for the last row', () => {
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

    expect(wrapper.find('[data-test-id="screen-move-up-screen1"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-test-id="screen-move-down-screen2"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-test-id="screen-move-down-screen1"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-test-id="screen-move-up-screen2"]').attributes('disabled')).toBeUndefined()
  })

  it('shows a saving indicator and disables the move buttons while a reorder request is in flight', async () => {
    screensStoreMock.screens = [
      { id: 'screen1', filename: 'file1', externalLink: null, isActive: true, device: 'device1', fetchManual: false, html: '' },
      { id: 'screen2', filename: 'file2', externalLink: null, isActive: false, device: 'device1', fetchManual: false, html: '' },
    ]
    let resolveReorder: () => void = () => {}
    screensStoreMock.reorderScreens.mockReturnValue(new Promise<void>((resolve) => {
      resolveReorder = resolve
    }))
    const wrapper = mount(ScreenListCard, {
      props: { deviceId: 'device1' },
      global: {
        plugins: [createPinia(), vuetify],
      },
    })

    expect(wrapper.find('[data-test-id="reorder-saving-indicator"]').exists()).toBe(false)

    await wrapper.find('[data-test-id="screen-move-down-screen1"]').trigger('click')
    expect(wrapper.find('[data-test-id="reorder-saving-indicator"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="screen-move-up-screen2"]').attributes('disabled')).toBeDefined()

    resolveReorder()
    await flushPromises()

    expect(wrapper.find('[data-test-id="reorder-saving-indicator"]').exists()).toBe(false)
  })

  it('shows an error alert when the reorder request fails', async () => {
    screensStoreMock.screens = [
      { id: 'screen1', filename: 'file1', externalLink: null, isActive: true, device: 'device1', fetchManual: false, html: '' },
      { id: 'screen2', filename: 'file2', externalLink: null, isActive: false, device: 'device1', fetchManual: false, html: '' },
    ]
    screensStoreMock.reorderScreens.mockRejectedValue(new Error('Failed to reorder screens'))
    const wrapper = mount(ScreenListCard, {
      props: { deviceId: 'device1' },
      global: {
        plugins: [createPinia(), vuetify],
      },
    })

    await wrapper.find('[data-test-id="screen-move-down-screen1"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test-id="reorder-error-alert"]').exists()).toBe(true)
  })

  it('reorders via drag and drop and calls reorderScreens with the new order', async () => {
    screensStoreMock.screens = [
      { id: 'screen1', filename: 'file1', externalLink: null, isActive: true, device: 'device1', fetchManual: false, html: '' },
      { id: 'screen2', filename: 'file2', externalLink: null, isActive: false, device: 'device1', fetchManual: false, html: '' },
    ]
    screensStoreMock.reorderScreens.mockResolvedValue(undefined)
    const wrapper = mount(ScreenListCard, {
      props: { deviceId: 'device1' },
      global: {
        plugins: [createPinia(), vuetify],
      },
    })

    const firstRow = wrapper.find('[data-test-id="screen-row-screen1"]')
    const secondRow = wrapper.find('[data-test-id="screen-row-screen2"]')
    await firstRow.trigger('dragstart')
    await secondRow.trigger('dragover')
    await secondRow.trigger('drop')

    expect(screensStoreMock.reorderScreens).toHaveBeenCalledWith('device1', ['screen2', 'screen1'])
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

  describe('schedule column', () => {
    function mountWithScreens(screens: any[]) {
      screensStoreMock.screens = screens
      return mount(ScreenListCard, {
        props: { deviceId: 'device1' },
        global: { plugins: [createPinia(), vuetify] },
      })
    }

    const baseScreen = { filename: 'file1', externalLink: null, isActive: false, device: 'device1', fetchManual: false, html: '' }

    it('reads as always for a screen with no schedule', () => {
      const wrapper = mountWithScreens([{ ...baseScreen, id: 'screen1' }])
      expect(wrapper.find('[data-test-id="screen-schedule-btn-screen1"]').text()).toBe('Always')
    })

    it('summarises the schedule a screen carries', () => {
      const wrapper = mountWithScreens([
        { ...baseScreen, id: 'screen1', schedule: { id: 's1', enabled: true, weekdays: [1, 2, 3, 4, 5], startTime: '07:00:00', endTime: '09:00:00' } },
      ])
      expect(wrapper.find('[data-test-id="screen-schedule-btn-screen1"]').text()).toBe('Mon, Tue, Wed, Thu, Fri · 07:00–09:00')
    })

    it('marks a disabled schedule while still showing its rules', () => {
      const wrapper = mountWithScreens([
        { ...baseScreen, id: 'screen1', schedule: { id: 's1', enabled: false, weekdays: [0] } },
      ])
      expect(wrapper.find('[data-test-id="screen-schedule-btn-screen1"]').text()).toBe('Disabled · Sun')
    })

    it('opens the schedule dialog for the screen that was clicked', async () => {
      const wrapper = mountWithScreens([
        { ...baseScreen, id: 'screen1' },
        { ...baseScreen, id: 'screen2', filename: 'file2' },
      ])

      await wrapper.find('[data-test-id="screen-schedule-btn-screen2"]').trigger('click')
      await flushPromises()

      const dialog = document.querySelector('[data-test-id="schedule-dialog"]')
      expect(dialog?.textContent).toContain('file2')
    })
  })
})
