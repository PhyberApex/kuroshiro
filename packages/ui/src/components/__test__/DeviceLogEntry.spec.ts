import type { LogEntry, ParsedDeviceLogPayload } from '@/types.ts'
import { mount } from '@vue/test-utils'
import rop from 'resize-observer-polyfill'
import { describe, expect, it } from 'vitest'
import vuetify from '../../plugins/vuetify'
import DeviceLogEntry from '../DeviceLogEntry.vue'

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

const logEntry: LogEntry = { logId: 1, date: new Date('2026-01-01T12:00:00Z'), entry: 'raw entry text' }

function mountEntry(parsed: ParsedDeviceLogPayload | null = null, entry: LogEntry = logEntry) {
  return mount(DeviceLogEntry, {
    props: { logEntry: entry, parsed },
    global: { plugins: [vuetify] },
  })
}

describe('deviceLogEntry', () => {
  it('falls back to the raw entry text when parsing failed', () => {
    const wrapper = mountEntry(null)
    expect(wrapper.find('[data-test-id="log-list-item"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('raw entry text')
  })

  it('prefers the parsed log message over the raw entry', () => {
    const wrapper = mountEntry({ log_message: 'Something failed' })
    expect(wrapper.text()).toContain('Something failed')
    expect(wrapper.text()).not.toContain('raw entry text')
  })

  it('shows the source file chip only when present', () => {
    const withSource = mountEntry({ log_message: 'info message', log_sourcefile: 'main.c', log_codeline: 42 })
    expect(withSource.text()).toContain('main.c:42')

    const withoutSource = mountEntry({ log_message: 'info message' })
    expect(withoutSource.text()).not.toContain('main.c')
  })

  it('hides the details expansion panel when there is no status or additional info', () => {
    const wrapper = mountEntry({ log_message: 'info message' })
    expect(wrapper.find('[data-test-id="log-entry-details-toggle"]').exists()).toBe(false)
  })

  it('shows device status fields inside the details panel', async () => {
    const wrapper = mountEntry({
      log_message: 'status update',
      device_status_stamp: {
        wifi_rssi_level: -55,
        battery_voltage: 3.7,
        current_fw_version: '1.2.3',
        free_heap_size: 20480,
        wakeup_reason: 'timer',
        wifi_status: 'connected',
      },
    })
    const toggle = wrapper.find('[data-test-id="log-entry-details-toggle"]')
    expect(toggle.exists()).toBe(true)
    await toggle.trigger('click')

    expect(wrapper.text()).toContain('-55 dBm')
    expect(wrapper.text()).toContain('3.7 V')
    expect(wrapper.text()).toContain('1.2.3')
    expect(wrapper.text()).toContain('20.0 KB')
    expect(wrapper.text()).toContain('timer')
    expect(wrapper.text()).toContain('connected')
  })

  it('shows additional info entries and falls back to an em dash for falsy values', async () => {
    const wrapper = mountEntry({
      log_message: 'extra info',
      additional_info: { retries: 0, note: 'ok' },
    })
    const toggle = wrapper.find('[data-test-id="log-entry-details-toggle"]')
    expect(toggle.exists()).toBe(true)
    await toggle.trigger('click')

    expect(wrapper.text()).toContain('retries')
    expect(wrapper.text()).toContain('—')
    expect(wrapper.text()).toContain('note')
    expect(wrapper.text()).toContain('ok')
  })

  it('hides the additional info section when it is an empty object', () => {
    const wrapper = mountEntry({ log_message: 'no extras', additional_info: {} })
    expect(wrapper.find('[data-test-id="log-entry-details-toggle"]').exists()).toBe(false)
  })

  it.each([
    ['A critical error occurred', 'mdi-alert-circle'],
    ['This is just a warning', 'mdi-alert'],
    ['Info: startup complete', 'mdi-information'],
    ['nothing special happened', 'mdi-circle-small'],
  ])('picks the severity icon for message %s', (message, icon) => {
    const wrapper = mountEntry({ log_message: message })
    expect(wrapper.html()).toContain(icon)
  })
})
