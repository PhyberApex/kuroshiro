import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import App from '../App.vue'
import vuetify from '../plugins/vuetify'
import router from '../router'

globalThis.ResizeObserver = rop

const MOBILE_WIDTH = 375
const DESKTOP_WIDTH = 1280
const DEFAULT_TEST_WIDTH = 1024

async function setWindowWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width })
  window.dispatchEvent(new Event('resize'))
  await nextTick()
}

function mountApp() {
  return mount(App, {
    global: {
      plugins: [createPinia(), router, vuetify],
    },
  })
}

describe('app', () => {
  afterEach(async () => {
    await setWindowWidth(DEFAULT_TEST_WIDTH)
  })

  it('mounts without error', () => {
    const wrapper = mountApp()
    expect(wrapper.exists()).toBe(true)
  })

  it('hides the tab strip and keeps the title visible on narrow viewports', async () => {
    await setWindowWidth(MOBILE_WIDTH)
    const wrapper = mountApp()
    expect(wrapper.findComponent({ name: 'VTabs' }).exists()).toBe(false)
    expect(wrapper.find('.v-app-bar-title').text()).toContain('Kuroshiro')
  })

  it('shows the tab strip on wide viewports', async () => {
    await setWindowWidth(DESKTOP_WIDTH)
    const wrapper = mountApp()
    expect(wrapper.findComponent({ name: 'VTabs' }).exists()).toBe(true)
  })
})
