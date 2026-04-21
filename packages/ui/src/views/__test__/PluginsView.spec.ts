import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { describe, expect, it } from 'vitest'
import vuetify from '../../plugins/vuetify'
import PluginsView from '../PluginsView.vue'

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

describe('pluginsView', () => {
  it('renders without error', () => {
    const wrapper = mount(PluginsView, {
      global: {
        plugins: [createPinia(), vuetify],
      },
    })

    expect(wrapper.exists()).toBe(true)
  })
})
