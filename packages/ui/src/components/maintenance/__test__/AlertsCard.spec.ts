import type { AlertSummary } from 'kuroshiro-shared'
import { mount } from '@vue/test-utils'
import rop from 'resize-observer-polyfill'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import vuetify from '@/plugins/vuetify'
import AlertsCard from '../AlertsCard.vue'

globalThis.ResizeObserver = rop

const ACTIVE_ALERT: AlertSummary = { id: 'alert-1', kind: 'device-offline', deviceId: 'device-1', deviceName: 'Living Room', openedAt: '2026-01-10T00:00:00.000Z', resolvedAt: null, details: null }
const RESOLVED_ALERT: AlertSummary = { id: 'alert-2', kind: 'device-low-battery', deviceId: 'device-2', deviceName: 'Kitchen', openedAt: '2026-01-01T00:00:00.000Z', resolvedAt: '2026-01-02T00:00:00.000Z', details: null }

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/devices/:id', name: 'device', component: { template: '<div />' } }],
})

function mountCard(props: Partial<InstanceType<typeof AlertsCard>['$props']> = {}) {
  return mount(AlertsCard, {
    props: {
      active: [],
      resolved: [],
      error: null,
      sendingTestNotification: false,
      testNotificationResult: null,
      ...props,
    },
    global: { plugins: [vuetify, router] },
  })
}

describe('alertsCard', () => {
  it('shows empty states when there are no active or resolved Alerts', () => {
    const wrapper = mountCard()
    expect(wrapper.find('[data-test-id="no-active-alerts"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="no-resolved-alerts"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="active-alerts-list"]').exists()).toBe(false)
    expect(wrapper.find('[data-test-id="resolved-alerts-list"]').exists()).toBe(false)
  })

  it('renders a row per active Alert with the Rule label and Device name', () => {
    const wrapper = mountCard({ active: [ACTIVE_ALERT] })
    expect(wrapper.find('[data-test-id="no-active-alerts"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Offline')
    expect(wrapper.text()).toContain('Living Room')
  })

  it('renders a row per resolved Alert with opened and resolved timestamps', () => {
    const wrapper = mountCard({ resolved: [RESOLVED_ALERT] })
    expect(wrapper.find('[data-test-id="no-resolved-alerts"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Low battery')
    expect(wrapper.text()).toContain('Kitchen')
  })

  it('links only the Device name to that Device, not the whole row', () => {
    const wrapper = mountCard({ active: [ACTIVE_ALERT] })
    const link = wrapper.find('[data-test-id="active-alerts-list"] a')
    expect(link.text()).toBe('Living Room')
    expect(link.attributes('href')).toBe('/devices/device-1')
  })

  it('emits sendTestNotification when the button is clicked', async () => {
    const wrapper = mountCard()
    await wrapper.find('[data-test-id="send-test-notification-btn"]').trigger('click')
    expect(wrapper.emitted('sendTestNotification')).toHaveLength(1)
  })

  it('shows the button in a loading state while sending', () => {
    const wrapper = mountCard({ sendingTestNotification: true })
    expect(wrapper.find('[data-test-id="send-test-notification-btn"]').classes()).toContain('v-btn--loading')
  })

  it('renders a success alert with the API message and can be dismissed', async () => {
    const wrapper = mountCard({ testNotificationResult: { ok: true, message: 'Test notification sent successfully.' } })
    expect(wrapper.text()).toContain('Test notification sent successfully.')
    await wrapper.find('[data-test-id="test-notification-result"] .v-alert__close button').trigger('click')
    expect(wrapper.emitted('dismissTestNotificationResult')).toHaveLength(1)
  })

  it('renders a failure alert with the API message', () => {
    const wrapper = mountCard({ testNotificationResult: { ok: false, message: 'Apprise is not configured.' } })
    expect(wrapper.text()).toContain('Apprise is not configured.')
  })

  it('surfaces a store error without hiding the rest of the card', () => {
    const wrapper = mountCard({ error: 'Failed to load Alerts: Internal Server Error' })
    expect(wrapper.text()).toContain('Failed to load Alerts: Internal Server Error')
    expect(wrapper.find('[data-test-id="no-active-alerts"]').exists()).toBe(true)
  })
})
