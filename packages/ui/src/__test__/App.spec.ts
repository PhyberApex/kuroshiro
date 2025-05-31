import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { describe, expect, it } from 'vitest'
import App from '../App.vue'
import vuetify from '../plugins/vuetify'
import router from '../router'

globalThis.ResizeObserver = rop

describe('app', () => {
  it('mounts without error', () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia(), router, vuetify],
      },
    })
    expect(wrapper.exists()).toBe(true)
  })
})
