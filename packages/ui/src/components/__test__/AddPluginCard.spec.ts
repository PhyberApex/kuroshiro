import type { usePluginsStore } from '@/stores/plugins'
import type { useScreensStore } from '@/stores/screens'
import type { Plugin } from '@/types/plugin'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '../../plugins/vuetify'
import { asStore } from '../../test/mockStore'
import AddPluginCard from '../AddPluginCard.vue'

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

let pluginsStoreMock: ReturnType<typeof usePluginsStore>
let screensStoreMock: ReturnType<typeof useScreensStore>
let allPlugins: Plugin[]

vi.mock('@/stores/plugins', () => ({
  usePluginsStore: () => pluginsStoreMock,
}))
vi.mock('@/stores/screens', () => ({
  useScreensStore: () => screensStoreMock,
}))

function makePlugin(id: string, assignedDeviceIds: string[] = []): Plugin {
  return {
    id,
    name: `Plugin ${id}`,
    kind: 'Poll',
    refreshInterval: 15,
    createdAt: new Date(),
    updatedAt: new Date(),
    deviceAssignments: assignedDeviceIds.map(deviceId => ({
      id: `assignment-${id}-${deviceId}`,
      isActive: true,
      order: 0,
      device: { id: deviceId, name: `Device ${deviceId}` },
    })),
  }
}

function mountCard() {
  return mount(AddPluginCard, {
    props: { deviceId: 'device-1' },
    global: {
      plugins: [createPinia(), vuetify],
    },
  })
}

describe('addPluginCard', () => {
  beforeEach(() => {
    allPlugins = []
    pluginsStoreMock = asStore<ReturnType<typeof usePluginsStore>>({
      fetchAllPlugins: vi.fn(async () => allPlugins),
      assignToDevice: vi.fn(async () => ({})),
    })
    screensStoreMock = asStore<ReturnType<typeof useScreensStore>>({
      fetchScreensForDevice: vi.fn(async () => {}),
    })
  })

  it('offers only plugins not already assigned to this device', async () => {
    allPlugins = [
      makePlugin('free'),
      makePlugin('elsewhere', ['device-2']),
      makePlugin('taken', ['device-1']),
    ]
    const wrapper = mountCard()
    await flushPromises()

    expect(wrapper.vm.availablePlugins.map(p => p.value)).toEqual(['free', 'elsewhere'])
    expect(wrapper.find('[data-test-id="plugin-empty-state"]').exists()).toBe(false)
    expect(wrapper.find('[data-test-id="create-plugin-link"]').exists()).toBe(true)
  })

  it('shows an empty state with a create link when nothing is left to assign', async () => {
    allPlugins = [makePlugin('taken', ['device-1'])]
    const wrapper = mountCard()
    await flushPromises()

    expect(wrapper.find('[data-test-id="plugin-empty-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="create-plugin-link"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="plugin-select"]').exists()).toBe(false)
  })

  it('assigns the chosen plugin, refreshes the screens list and drops it from the picker', async () => {
    allPlugins = [makePlugin('free'), makePlugin('other')]
    const wrapper = mountCard()
    await flushPromises()

    const submit = wrapper.find('[data-test-id="plugin-assign-btn"]')
    expect(submit.attributes('disabled')).toBeDefined()

    wrapper.vm.selectedPluginId = 'free'
    await wrapper.vm.$nextTick()
    expect(submit.attributes('disabled')).toBeUndefined()

    allPlugins = [makePlugin('free', ['device-1']), makePlugin('other')]
    await submit.trigger('click')
    await flushPromises()

    expect(pluginsStoreMock.assignToDevice).toHaveBeenCalledWith('free', 'device-1')
    expect(screensStoreMock.fetchScreensForDevice).toHaveBeenCalledWith('device-1')
    expect(wrapper.vm.availablePlugins.map(p => p.value)).toEqual(['other'])
    expect(wrapper.vm.selectedPluginId).toBe('')
  })

  it('surfaces an assignment failure', async () => {
    allPlugins = [makePlugin('free')]
    pluginsStoreMock.assignToDevice = vi.fn(async () => {
      throw new Error('nope')
    })
    const wrapper = mountCard()
    await flushPromises()

    wrapper.vm.selectedPluginId = 'free'
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-test-id="plugin-assign-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('nope')
    expect(screensStoreMock.fetchScreensForDevice).not.toHaveBeenCalled()
  })
})
