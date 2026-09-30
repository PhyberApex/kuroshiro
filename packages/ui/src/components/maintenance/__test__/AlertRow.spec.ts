import type { AlertSummary } from 'kuroshiro-shared'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import vuetify from '@/plugins/vuetify'
import AlertRow from '../AlertRow.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/devices/:id', name: 'device', component: { template: '<div />' } }],
})

function mountRow(alert: AlertSummary, showResolved = false) {
  return mount(AlertRow, {
    props: { alert, showResolved },
    global: { plugins: [vuetify, router] },
  })
}

describe('alertRow', () => {
  it('links a Device-subject Alert\'s name to that Device', () => {
    const alert: AlertSummary = { id: 'alert-1', kind: 'device-offline', deviceId: 'device-1', deviceName: 'Living Room', openedAt: '2026-01-10T00:00:00.000Z', resolvedAt: null, details: null }
    const wrapper = mountRow(alert)

    const link = wrapper.find('a')
    expect(link.text()).toBe('Living Room')
    expect(link.attributes('href')).toBe('/devices/device-1')
  })

  it('renders a Data-Source-subject Alert as "Plugin name / Data Source name" with no link', () => {
    const alert: AlertSummary = {
      id: 'alert-2',
      kind: 'data-source-fetch-failing',
      pluginName: 'Weather Dashboard',
      dataSourceName: 'Weather API',
      openedAt: '2026-01-10T00:00:00.000Z',
      resolvedAt: null,
      details: { streak: 3, lastError: 'timeout' },
    }
    const wrapper = mountRow(alert)

    expect(wrapper.text()).toContain('Fetch failing')
    expect(wrapper.text()).toContain('Weather Dashboard / Weather API')
    expect(wrapper.find('a').exists()).toBe(false)
  })
})
