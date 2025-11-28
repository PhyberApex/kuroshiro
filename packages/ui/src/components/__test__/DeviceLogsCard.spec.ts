import type { LogEntry } from '@/types.ts'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '../../plugins/vuetify'
import DeviceLogsCard from '../DeviceLogsCard.vue'

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

// Use a local variable to control the mock return value
let logStoreMock: any
vi.mock('@/stores/logs', () => ({
  useLogStore: () => logStoreMock,
}))
// Mock the device store
vi.mock('@/stores/device', () => ({
  useDeviceStore: () => ({
    getById: vi.fn(() => ({ id: 'device1', width: 800, height: 480 })),
  }),
}))

describe('deviceLogsCard', () => {
  beforeEach(() => {
    logStoreMock = {
      error: '',
      logEntries: [] as LogEntry[],
      loading: false,
      clearLogs: vi.fn(),
    }
  })

  it('renders without error and shows empty state', () => {
    const wrapper = mount(DeviceLogsCard, {
      props: { deviceId: 'device1' },
      global: {
        plugins: [createPinia(), vuetify],
      },
    })
    expect(wrapper.find('[data-test-id="log-list-empty-alert"]').exists()).toBe(true)
  })

  it('renders list and clear log button when logs exist', () => {
    logStoreMock.logEntries = [
      { logId: 1, date: new Date(), entry: '' },
      { logId: 2, date: new Date(), entry: '' },
    ]
    const wrapper = mount(DeviceLogsCard, {
      props: { deviceId: 'device1' },
      global: {
        plugins: [createPinia(), vuetify],
      },
    })
    expect(wrapper.find('[data-test-id="logs-list"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="clear-log-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="logs-list"]').findAll('[data-test-id="log-list-item"]').length).toBe(2)
  })
})
