import type { RetentionStatus } from 'kuroshiro-shared'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import vuetify from '@/plugins/vuetify'
import RetentionCard from '../RetentionCard.vue'

const STATUS: RetentionStatus = {
  ages: { alertRetentionDays: 90, deviceLogRetentionDays: 30 },
  lastRun: null,
}

function mountCard(props: Partial<InstanceType<typeof RetentionCard>['$props']> = {}) {
  return mount(RetentionCard, {
    props: {
      status: STATUS,
      running: false,
      error: null,
      ...props,
    },
    global: { plugins: [vuetify] },
  })
}

describe('retentionCard', () => {
  it('shows the configured retention ages', () => {
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('Alerts: 90 days')
    expect(wrapper.text()).toContain('Device Logs: 30 days')
  })

  it('shows disabled for a retention age of 0', () => {
    const wrapper = mountCard({ status: { ages: { alertRetentionDays: 0, deviceLogRetentionDays: 30 }, lastRun: null } })
    expect(wrapper.text()).toContain('Alerts: disabled')
  })

  it('reports no run since startup when lastRun is null', () => {
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('Retention has not run since startup.')
  })

  it('shows the last run time and counts', () => {
    const wrapper = mountCard({
      status: {
        ages: { alertRetentionDays: 90, deviceLogRetentionDays: 30 },
        lastRun: { alertsPruned: 3, deviceLogsPruned: 12, ranAt: '2026-04-24T12:00:00Z' },
      },
    })
    expect(wrapper.text()).toContain('pruned 3 Alerts, 12 Device Log entries')
  })

  it('emits run when the button is clicked', async () => {
    const wrapper = mountCard()
    await wrapper.find('[data-test-id="run-retention-btn"]').trigger('click')
    expect(wrapper.emitted('run')).toHaveLength(1)
  })

  it('disables the run button while status has not loaded', () => {
    const wrapper = mountCard({ status: null })
    expect(wrapper.find('[data-test-id="run-retention-btn"]').attributes('disabled')).toBeDefined()
  })

  it('shows an error alert when given one', () => {
    const wrapper = mountCard({ error: 'Retention run failed: Internal Server Error' })
    expect(wrapper.text()).toContain('Retention run failed: Internal Server Error')
  })
})
