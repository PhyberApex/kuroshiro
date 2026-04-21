import type { Plugin } from '@/types/plugin'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '../../plugins/vuetify'
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

let pluginsStoreMock: any
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
    template: '<div></div>',
  },
}))

describe('pluginCard', () => {
  beforeEach(() => {
    pluginsStoreMock = {
      deletePlugin: vi.fn(),
      updateDeviceAssignment: vi.fn(),
      fetchPluginsForDevice: vi.fn(),
    }
    mockRouter.push.mockClear()
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
    const plugin = {
      ...basePlugin,
      deviceAssignments: [{}, {}] as any,
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

  it('shows edit button and navigates on click', async () => {
    const wrapper = mount(PluginCard, {
      props: { plugin: basePlugin },
      global: {
        plugins: [createPinia(), vuetify],
      },
    })

    const editBtn = wrapper.findAll('button').find(btn => btn.text().includes('Edit'))
    expect(editBtn).toBeTruthy()
    await editBtn!.trigger('click')

    expect(mockRouter.push).toHaveBeenCalledWith({
      name: 'pluginEdit',
      params: { id: 'plugin-1' },
    })
  })

  it('shows assign button when not on device page', () => {
    const wrapper = mount(PluginCard, {
      props: { plugin: basePlugin },
      global: {
        plugins: [createPinia(), vuetify],
      },
    })

    expect(wrapper.text()).toContain('Assign to Devices')
  })

  it('shows enable/disable button when on device page', () => {
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

    expect(wrapper.text()).toContain('Disable')
  })

  it('shows delete button', async () => {
    const wrapper = mount(PluginCard, {
      props: { plugin: basePlugin },
      global: {
        plugins: [createPinia(), vuetify],
      },
    })

    const deleteBtn = wrapper.findAll('button').find(btn => btn.text().includes('Delete'))
    expect(deleteBtn).toBeTruthy()
  })
})
