import type { Plugin } from '@/types/plugin'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '../../plugins/vuetify'
import PluginsOverviewView from '../PluginsOverviewView.vue'

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

const mockRouter = {
  push: vi.fn(),
}
vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
}))

describe('pluginsOverviewView', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn()
    mockRouter.push.mockClear()
  })

  const mockPlugin: Plugin = {
    id: 'plugin-1',
    name: 'Test Plugin',
    description: 'Test Description',
    kind: 'Poll',
    refreshInterval: 15,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it('renders empty state when no plugins', async () => {
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [],
    })

    const wrapper = mount(PluginsOverviewView, {
      global: {
        plugins: [createPinia(), vuetify],
      },
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(wrapper.text()).toContain('No plugins yet')
    expect(wrapper.text()).toContain('Create Your First Plugin')
  })

  it('renders plugin cards when plugins exist', async () => {
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [mockPlugin],
    })

    const wrapper = mount(PluginsOverviewView, {
      global: {
        plugins: [createPinia(), vuetify],
      },
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(wrapper.text()).toContain('Test Plugin')
  })

  it('navigates to create plugin on button click', async () => {
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [],
    })

    const wrapper = mount(PluginsOverviewView, {
      global: {
        plugins: [createPinia(), vuetify],
      },
    })

    await wrapper.vm.$nextTick()

    const createBtn = wrapper.findAll('button').find(btn => btn.text().includes('Create'))
    await createBtn!.trigger('click')

    expect(mockRouter.push).toHaveBeenCalledWith({ name: 'pluginCreate' })
  })
})
