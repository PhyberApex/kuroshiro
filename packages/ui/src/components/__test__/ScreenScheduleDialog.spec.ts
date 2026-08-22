import type { Screen } from '@/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '../../plugins/vuetify'
import ScreenScheduleDialog from '../ScreenScheduleDialog.vue'

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

globalThis.visualViewport = globalThis.visualViewport || {
  addEventListener: () => {},
  removeEventListener: () => {},
  width: 1024,
  height: 768,
  offsetLeft: 0,
  offsetTop: 0,
  pageLeft: 0,
  pageTop: 0,
  scale: 1,
} as any

let scheduleStoreMock: any
vi.mock('@/stores/schedule', () => ({
  useScheduleStore: () => scheduleStoreMock,
}))

let screensStoreMock: any
vi.mock('@/stores/screens', () => ({
  useScreensStore: () => screensStoreMock,
}))

const unscheduledScreen = { id: 'screen-1', filename: 'Bus times', isActive: false, device: 'device-1', fetchManual: false } as Screen

function mountDialog(screen: Screen) {
  return mount(ScreenScheduleDialog, {
    props: { modelValue: true, deviceId: 'device-1', screen },
    global: { plugins: [createPinia(), vuetify] },
    attachTo: document.body,
  })
}

// VDialog teleports its content to the body, out of the wrapper's reach.
function setInput(testId: string, value: string) {
  const input = document.querySelector(`[data-test-id="${testId}"] input`) as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input'))
  return flushPromises()
}

function clickButton(testId: string) {
  const button = document.querySelector(`[data-test-id="${testId}"]`) as HTMLElement
  button.click()
  return flushPromises()
}

describe('screenScheduleDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    scheduleStoreMock = {
      create: vi.fn().mockResolvedValue({ id: 'schedule-1' }),
      update: vi.fn().mockResolvedValue({ id: 'schedule-1' }),
      remove: vi.fn().mockResolvedValue(undefined),
    }
    screensStoreMock = { fetchScreensForDevice: vi.fn().mockResolvedValue(undefined) }
  })

  it('creates a schedule for a screen that has none', async () => {
    const wrapper = mountDialog(unscheduledScreen)
    await flushPromises()

    await setInput('schedule-start-time', '07:00')
    await setInput('schedule-end-time', '09:00')
    await clickButton('schedule-save-btn')

    expect(scheduleStoreMock.create).toHaveBeenCalledWith('screen-1', {
      enabled: true,
      weekdays: null,
      startTime: '07:00',
      endTime: '09:00',
      startDate: null,
      endDate: null,
    })
    expect(screensStoreMock.fetchScreensForDevice).toHaveBeenCalledWith('device-1')
    expect(wrapper.emitted('update:modelValue')).toContainEqual([false])
  })

  it('updates the existing schedule of an already scheduled screen', async () => {
    const scheduled = { ...unscheduledScreen, schedule: { id: 'schedule-1', enabled: true, weekdays: [1, 2], startTime: '07:00:00', endTime: '09:00:00' } } as Screen
    mountDialog(scheduled)
    await flushPromises()

    await setInput('schedule-start-time', '08:00')
    await clickButton('schedule-save-btn')

    expect(scheduleStoreMock.create).not.toHaveBeenCalled()
    expect(scheduleStoreMock.update).toHaveBeenCalledWith('screen-1', expect.objectContaining({
      weekdays: [1, 2],
      startTime: '08:00',
      endTime: '09:00',
    }))
  })

  it('offers removing the schedule only once one exists', async () => {
    mountDialog(unscheduledScreen)
    await flushPromises()
    expect(document.querySelector('[data-test-id="schedule-remove-btn"]')).toBeNull()

    document.body.innerHTML = ''
    mountDialog({ ...unscheduledScreen, schedule: { id: 'schedule-1', enabled: true } } as Screen)
    await flushPromises()

    await clickButton('schedule-remove-btn')
    expect(scheduleStoreMock.remove).toHaveBeenCalledWith('screen-1')
  })

  it('refuses to save half a time window', async () => {
    mountDialog(unscheduledScreen)
    await flushPromises()

    await setInput('schedule-start-time', '07:00')
    await clickButton('schedule-save-btn')

    expect(scheduleStoreMock.create).not.toHaveBeenCalled()
    expect(document.querySelector('[data-test-id="schedule-error"]')?.textContent)
      .toContain('Set both a start and an end time')
  })

  it('refuses to save a date range that ends before it starts', async () => {
    mountDialog(unscheduledScreen)
    await flushPromises()

    await setInput('schedule-start-date', '2026-12-25')
    await setInput('schedule-end-date', '2026-12-01')
    await clickButton('schedule-save-btn')

    expect(scheduleStoreMock.create).not.toHaveBeenCalled()
    expect(document.querySelector('[data-test-id="schedule-error"]')?.textContent)
      .toContain('start date must not be after the end date')
  })

  it('points out that a window crosses midnight', async () => {
    mountDialog(unscheduledScreen)
    await flushPromises()

    await setInput('schedule-start-time', '22:00')
    await setInput('schedule-end-time', '02:00')
    await flushPromises()

    expect(document.querySelector('[data-test-id="schedule-midnight-hint"]')).not.toBeNull()
  })

  it('shows the error the API rejected the save with', async () => {
    scheduleStoreMock.create = vi.fn().mockRejectedValue(new Error('Screen already has a schedule'))
    const wrapper = mountDialog(unscheduledScreen)
    await flushPromises()

    await clickButton('schedule-save-btn')

    expect(document.querySelector('[data-test-id="schedule-error"]')?.textContent)
      .toContain('Screen already has a schedule')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
