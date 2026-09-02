import type { usePluginsStore } from '@/stores/plugins'
import type { DeviceAssignment, Plugin } from '@/types/plugin'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '../../plugins/vuetify'
import { asStore } from '../../test/mockStore'
import PluginCard from '../PluginCard.vue'

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

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('../PluginAssignDialog.vue', () => ({
  default: {
    name: 'PluginAssignDialog',
    template: '<div></div>',
  },
}))

describe('pluginCard', () => {
  beforeEach(() => {
    pluginsStoreMock = asStore<ReturnType<typeof usePluginsStore>>({
      deletePlugin: vi.fn(),
      updateDeviceAssignment: vi.fn(),
      fetchPluginsForDevice: vi.fn(),
    })
  })

  const basePlugin: Plugin = {
    id: 'plugin-1',
    name: 'Test Plugin',
    description: 'Test Description',
    kind: 'Poll',
    refreshInterval: 15,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it('renders plugin name and description', () => {
    const wrapper = mount(PluginCard, {
      props: { plugin: basePlugin },
      global: {
        plugins: [createPinia(), vuetify],
      },
    })

    expect(wrapper.text()).toContain('Test Plugin')
    expect(wrapper.text()).toContain('Test Description')
  })

  it('shows "No description" when description is empty', () => {
    const plugin = { ...basePlugin, description: '' }
    const wrapper = mount(PluginCard, {
      props: { plugin },
      global: {
        plugins: [createPinia(), vuetify],
      },
    })

    expect(wrapper.text()).toContain('No description')
  })

  it('shows assigned device count when not on device page', () => {
    const deviceAssignment = (id: string): DeviceAssignment => ({ id, isActive: true, order: 0, device: { id, name: `Device ${id}` } })
    const plugin = {
      ...basePlugin,
      deviceAssignments: [deviceAssignment('1'), deviceAssignment('2')],
    }
    const wrapper = mount(PluginCard, {
      props: { plugin },
      global: {
        plugins: [createPinia(), vuetify],
      },
    })

    expect(wrapper.text()).toContain('2 devices')
  })

  it('shows active status when on device page', () => {
    const plugin = {
      ...basePlugin,
      _isActive: true,
      _devicePluginId: 'dp-1',
    }
    const wrapper = mount(PluginCard, {
      props: { plugin, deviceId: 'device-1' },
      global: {
        plugins: [createPinia(), vuetify],
      },
    })

    expect(wrapper.text()).toContain('Active')
  })

  // Action-button behavior (edit/assign/toggle/export/delete) lives in PluginCardActions.vue
  // now and is covered by PluginCardActions.spec.ts.
})
