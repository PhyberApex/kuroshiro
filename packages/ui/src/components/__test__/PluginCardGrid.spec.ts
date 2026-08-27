import type { Plugin } from '@/types/plugin'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { describe, expect, it } from 'vitest'
import vuetify from '../../plugins/vuetify'
import PluginCardGrid from '../PluginCardGrid.vue'

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

const plugins: Plugin[] = [
  { id: 'plugin-1', name: 'Weather', description: '', kind: 'Poll', refreshInterval: 15, createdAt: new Date(), updatedAt: new Date() },
  { id: 'plugin-2', name: 'Calendar', description: '', kind: 'Poll', refreshInterval: 15, createdAt: new Date(), updatedAt: new Date() },
]

describe('pluginCardGrid', () => {
  it('renders one card per plugin', () => {
    const wrapper = mount(PluginCardGrid, {
      props: { plugins },
      global: { plugins: [createPinia(), vuetify] },
    })

    expect(wrapper.text()).toContain('Weather')
    expect(wrapper.text()).toContain('Calendar')
  })

  it('passes the optional deviceId through to each card', () => {
    const wrapper = mount(PluginCardGrid, {
      props: { plugins, deviceId: 'device1' },
      global: { plugins: [createPinia(), vuetify] },
    })

    expect(wrapper.findComponent({ name: 'PluginCard' }).props('deviceId')).toBe('device1')
  })

  it('re-emits assignments-changed and deleted from a card', async () => {
    const wrapper = mount(PluginCardGrid, {
      props: { plugins },
      global: { plugins: [createPinia(), vuetify] },
    })

    const card = wrapper.findComponent({ name: 'PluginCard' })
    card.vm.$emit('assignmentsChanged')
    card.vm.$emit('deleted')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('assignmentsChanged')).toHaveLength(1)
    expect(wrapper.emitted('deleted')).toHaveLength(1)
  })
})
