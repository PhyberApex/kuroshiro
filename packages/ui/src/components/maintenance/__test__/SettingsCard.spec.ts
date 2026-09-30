import type { InstanceSettingsResponse } from 'kuroshiro-shared'
import { mount } from '@vue/test-utils'
import rop from 'resize-observer-polyfill'
import { describe, expect, it } from 'vitest'
import vuetify from '@/plugins/vuetify'
import SettingsCard from '../SettingsCard.vue'

globalThis.ResizeObserver = rop

const UNOVERRIDDEN: InstanceSettingsResponse = {
  lowBatteryPercent: { override: null, value: 20, fallbackSource: 'default', fallbackValue: 20 },
  offlineMultiplier: { override: null, value: 3, fallbackSource: 'default', fallbackValue: 3 },
  fetchFailureThreshold: { override: null, value: 3, fallbackSource: 'default', fallbackValue: 3 },
}

function mountCard(props: Partial<InstanceType<typeof SettingsCard>['$props']> = {}) {
  return mount(SettingsCard, {
    props: {
      settings: UNOVERRIDDEN,
      error: null,
      saving: false,
      ...props,
    },
    global: { plugins: [vuetify] },
  })
}

describe('settingsCard', () => {
  it('shows the fallback value as the placeholder and names the built-in default as the source when unoverridden', () => {
    const wrapper = mountCard()
    const input = wrapper.find('[data-test-id="setting-lowBatteryPercent-input"] input')
    expect(input.attributes('placeholder')).toBe('20')
    expect((input.element as HTMLInputElement).value).toBe('')
    expect(wrapper.text()).toContain('Falls back to the built-in default (20)')
  })

  it('carries the shared validation bounds as native min/max attributes', () => {
    const wrapper = mountCard()
    const lowBattery = wrapper.find('[data-test-id="setting-lowBatteryPercent-input"] input')
    expect(lowBattery.attributes('min')).toBe('1')
    expect(lowBattery.attributes('max')).toBe('100')

    const offlineMultiplier = wrapper.find('[data-test-id="setting-offlineMultiplier-input"] input')
    expect(offlineMultiplier.attributes('min')).toBe('2')
    expect(offlineMultiplier.attributes('max')).toBeUndefined()
  })

  it('names the environment variable as the fallback source when the env var is set', () => {
    const settings: InstanceSettingsResponse = {
      ...UNOVERRIDDEN,
      lowBatteryPercent: { override: null, value: 15, fallbackSource: 'env', fallbackValue: 15 },
    }
    const wrapper = mountCard({ settings })
    expect(wrapper.text()).toContain('Falls back to KUROSHIRO_ALERT_LOW_BATTERY_PERCENT (currently 15)')
  })

  it('shows an override as the field\'s value and offers a reset button', () => {
    const settings: InstanceSettingsResponse = {
      ...UNOVERRIDDEN,
      lowBatteryPercent: { override: 45, value: 45, fallbackSource: 'default', fallbackValue: 20 },
    }
    const wrapper = mountCard({ settings })
    const input = wrapper.find('[data-test-id="setting-lowBatteryPercent-input"] input')
    expect((input.element as HTMLInputElement).value).toBe('45')
    expect(wrapper.find('[data-test-id="setting-lowBatteryPercent-reset-btn"]').exists()).toBe(true)
  })

  it('hides the reset button for an unoverridden Setting', () => {
    const wrapper = mountCard()
    expect(wrapper.find('[data-test-id="setting-lowBatteryPercent-reset-btn"]').exists()).toBe(false)
  })

  it('disables save until the field is edited away from its current value', async () => {
    const wrapper = mountCard()
    const saveBtn = wrapper.find('[data-test-id="setting-lowBatteryPercent-save-btn"]')
    expect(saveBtn.classes()).toContain('v-btn--disabled')

    await wrapper.find('[data-test-id="setting-lowBatteryPercent-input"] input').setValue('45')
    expect(saveBtn.classes()).not.toContain('v-btn--disabled')
  })

  it('emits save with the key and the parsed integer value', async () => {
    const wrapper = mountCard()
    await wrapper.find('[data-test-id="setting-offlineMultiplier-input"] input').setValue('5')
    await wrapper.find('[data-test-id="setting-offlineMultiplier-save-btn"]').trigger('click')

    expect(wrapper.emitted('save')).toEqual([['offlineMultiplier', 5]])
  })

  it('emits reset with the key when the reset button is clicked', async () => {
    const settings: InstanceSettingsResponse = {
      ...UNOVERRIDDEN,
      fetchFailureThreshold: { override: 7, value: 7, fallbackSource: 'default', fallbackValue: 3 },
    }
    const wrapper = mountCard({ settings })
    await wrapper.find('[data-test-id="setting-fetchFailureThreshold-reset-btn"]').trigger('click')

    expect(wrapper.emitted('reset')).toEqual([['fetchFailureThreshold']])
  })

  it('states that changes apply on the next Alert Sweep', () => {
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('next Alert Sweep')
  })

  it('surfaces a store error without hiding the rest of the card', () => {
    const wrapper = mountCard({ error: 'Failed to load Settings: Internal Server Error' })
    expect(wrapper.text()).toContain('Failed to load Settings: Internal Server Error')
    expect(wrapper.find('[data-test-id="setting-lowBatteryPercent-input"]').exists()).toBe(true)
  })
})
