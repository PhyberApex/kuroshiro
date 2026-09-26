import type { usePluginsStore } from '@/stores/plugins'
import type { Plugin } from '@/types/plugin'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '../../plugins/vuetify'
import { stubVisualViewport } from '../../test/browser'
import { asStore } from '../../test/mockStore'
import PluginCardActions from '../PluginCardActions.vue'

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

let pluginsStoreMock: ReturnType<typeof usePluginsStore>
vi.mock('@/stores/plugins', () => ({
  usePluginsStore: () => pluginsStoreMock,
}))

const mockRouter = {
  push: vi.fn(),
}
vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
}))

vi.mock('../PluginAssignDialog.vue', () => ({
  default: {
    name: 'PluginAssignDialog',
    props: ['modelValue', 'plugin'],
    emits: ['update:modelValue', 'assigned'],
    template: '<div data-test-id="assign-dialog-stub" />',
  },
}))

const basePlugin: Plugin = {
  id: 'plugin-1',
  name: 'Test Plugin',
  description: 'Test Description',
  kind: 'Poll',
  refreshInterval: 15,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function mountActions(props: { plugin: Plugin }) {
  return mount(PluginCardActions, {
    props,
    global: { plugins: [createPinia(), vuetify] },
    attachTo: document.body,
  })
}

function findButton(wrapper: ReturnType<typeof mountActions>, text: string) {
  return wrapper.findAll('button').find(btn => btn.text().includes(text))
}

describe('pluginCardActions', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    pluginsStoreMock = asStore<ReturnType<typeof usePluginsStore>>({
      deletePlugin: vi.fn().mockResolvedValue(undefined),
      duplicatePlugin: vi.fn().mockResolvedValue({ ...basePlugin, id: 'plugin-2', name: 'Test Plugin (copy)' }),
    })
    mockRouter.push.mockClear()
  })

  it('navigates to the edit route', async () => {
    const wrapper = mountActions({ plugin: basePlugin })

    await findButton(wrapper, 'Edit')!.trigger('click')

    expect(mockRouter.push).toHaveBeenCalledWith({ name: 'pluginEdit', params: { id: 'plugin-1' } })
  })

  it('opens the assign dialog', async () => {
    const wrapper = mountActions({ plugin: basePlugin })

    await findButton(wrapper, 'Assign to Devices')!.trigger('click')

    expect(wrapper.findComponent({ name: 'PluginAssignDialog' }).props('modelValue')).toBe(true)
  })

  it('forwards the assigned event from the dialog as assignmentsChanged', async () => {
    const wrapper = mountActions({ plugin: basePlugin })

    wrapper.findComponent({ name: 'PluginAssignDialog' }).vm.$emit('assigned')
    await flushPromises()

    expect(wrapper.emitted('assignmentsChanged')).toHaveLength(1)
  })

  it('duplicates the plugin immediately, with no confirmation dialog', async () => {
    const wrapper = mountActions({ plugin: basePlugin })

    await findButton(wrapper, 'Duplicate')!.trigger('click')

    expect(pluginsStoreMock.duplicatePlugin).toHaveBeenCalledWith('plugin-1')
    expect(wrapper.emitted('duplicated')).toHaveLength(1)
  })

  it('shows an error snackbar when duplication fails', async () => {
    pluginsStoreMock.duplicatePlugin = vi.fn().mockRejectedValue(new Error('boom'))
    const wrapper = mountActions({ plugin: basePlugin })

    await findButton(wrapper, 'Duplicate')!.trigger('click')

    expect(document.body.textContent).toContain('Failed to duplicate plugin')
    expect(wrapper.emitted('duplicated')).toBeUndefined()
  })

  it('shows a snackbar and triggers a browser download on export', async () => {
    const wrapper = mountActions({ plugin: basePlugin })
    const originalLocation = window.location
    Object.defineProperty(window, 'location', { value: { ...originalLocation, href: '' }, writable: true })

    await findButton(wrapper, 'Export')!.trigger('click')

    expect(window.location.href).toBe('/api/plugins/plugin-1/export')
    expect(document.body.textContent).toContain('Downloading plugin export...')

    Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
  })

  it('asks for confirmation before deleting, and deletes on confirm', async () => {
    const wrapper = mountActions({ plugin: basePlugin })

    await findButton(wrapper, 'Delete')!.trigger('click')
    expect(document.body.textContent).toContain('Delete Plugin?')
    expect(pluginsStoreMock.deletePlugin).not.toHaveBeenCalled()

    const confirmBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent?.trim() === 'Delete' && btn.closest('.v-overlay')) as HTMLElement
    confirmBtn.click()
    await flushPromises()

    expect(pluginsStoreMock.deletePlugin).toHaveBeenCalledWith('plugin-1')
    expect(wrapper.emitted('deleted')).toHaveLength(1)
  })

  it('warns about assigned devices in the delete confirmation', async () => {
    const plugin = { ...basePlugin, deviceAssignments: [{ id: '1', isActive: true, order: 0, device: { id: '1', name: 'Device 1' } }] }
    const wrapper = mountActions({ plugin })

    await findButton(wrapper, 'Delete')!.trigger('click')

    expect(document.body.textContent).toContain('This plugin is assigned to 1 device')
  })

  it('cancels the delete confirmation without deleting', async () => {
    const wrapper = mountActions({ plugin: basePlugin })

    await findButton(wrapper, 'Delete')!.trigger('click')
    const cancelBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent?.trim() === 'Cancel') as HTMLElement
    cancelBtn.click()
    await flushPromises()

    expect(pluginsStoreMock.deletePlugin).not.toHaveBeenCalled()
    expect(document.querySelector('.v-overlay--active')).toBeNull()
  })
})
