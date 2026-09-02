import type { usePluginsStore } from '@/stores/plugins'
import type { Plugin } from '@/types/plugin'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '../../plugins/vuetify'
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

Object.defineProperty(globalThis, 'visualViewport', {
  value: {
    width: 1024,
    height: 768,
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  writable: true,
})

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

function mountActions(props: { plugin: Plugin, deviceId?: string }) {
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
      updateDeviceAssignment: vi.fn().mockResolvedValue(undefined),
      fetchPluginsForDevice: vi.fn().mockResolvedValue(undefined),
    })
    mockRouter.push.mockClear()
  })

  it('navigates to the edit route', async () => {
    const wrapper = mountActions({ plugin: basePlugin })

    await findButton(wrapper, 'Edit')!.trigger('click')

    expect(mockRouter.push).toHaveBeenCalledWith({ name: 'pluginEdit', params: { id: 'plugin-1' } })
  })

  it('opens the assign dialog when not on a device page', async () => {
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

  it('toggles an active assignment off and refreshes the device plugin list', async () => {
    const plugin = { ...basePlugin, _isActive: true, _devicePluginId: 'dp-1' }
    const wrapper = mountActions({ plugin, deviceId: 'device-1' })

    await findButton(wrapper, 'Disable')!.trigger('click')

    expect(pluginsStoreMock.updateDeviceAssignment).toHaveBeenCalledWith('dp-1', { isActive: false })
    expect(pluginsStoreMock.fetchPluginsForDevice).toHaveBeenCalledWith('device-1')
  })

  it('toggles an inactive assignment on', async () => {
    const plugin = { ...basePlugin, _isActive: false, _devicePluginId: 'dp-1' }
    const wrapper = mountActions({ plugin, deviceId: 'device-1' })

    await findButton(wrapper, 'Enable')!.trigger('click')

    expect(pluginsStoreMock.updateDeviceAssignment).toHaveBeenCalledWith('dp-1', { isActive: true })
  })

  it('does not toggle when there is no device-plugin assignment yet', async () => {
    const plugin = { ...basePlugin, _isActive: false }
    const wrapper = mountActions({ plugin, deviceId: 'device-1' })

    await findButton(wrapper, 'Enable')!.trigger('click')

    expect(pluginsStoreMock.updateDeviceAssignment).not.toHaveBeenCalled()
    expect(pluginsStoreMock.fetchPluginsForDevice).not.toHaveBeenCalled()
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

    expect(pluginsStoreMock.deletePlugin).toHaveBeenCalledWith('plugin-1', undefined)
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

  it('passes the deviceId through to deletePlugin so devices can scope the delete', async () => {
    const wrapper = mountActions({ plugin: basePlugin, deviceId: 'device-1' })

    await findButton(wrapper, 'Delete')!.trigger('click')
    const confirmBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent?.trim() === 'Delete' && btn.closest('.v-overlay')) as HTMLElement
    confirmBtn.click()
    await flushPromises()

    expect(pluginsStoreMock.deletePlugin).toHaveBeenCalledWith('plugin-1', 'device-1')
  })
})
