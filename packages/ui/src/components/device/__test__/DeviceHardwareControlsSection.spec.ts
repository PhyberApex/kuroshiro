import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import vuetify from '@/plugins/vuetify'
import DeviceHardwareControlsSection from '../DeviceHardwareControlsSection.vue'

function mountSection(props: Partial<InstanceType<typeof DeviceHardwareControlsSection>['$props']> = {}) {
  return mount(DeviceHardwareControlsSection, {
    props: {
      specialFunctionTriggering: false,
      resetTriggering: false,
      refreshRateNumber: 300,
      refreshRateUnit: 'seconds',
      pendingSpecialFunction: 'none',
      ...props,
    },
    global: { plugins: [vuetify] },
  })
}

describe('deviceHardwareControlsSection', () => {
  it('disables the special function trigger button when none is selected', () => {
    const wrapper = mountSection()
    expect(wrapper.find('[data-test-id="device-special-function-trigger-btn"]').attributes('disabled')).toBeDefined()
  })

  it('enables the trigger button once a special function is selected', () => {
    const wrapper = mountSection({ pendingSpecialFunction: 'identify' })
    expect(wrapper.find('[data-test-id="device-special-function-trigger-btn"]').attributes('disabled')).toBeUndefined()
  })

  it('emits triggerSpecialFunction and triggerReset when clicked', async () => {
    const wrapper = mountSection({ pendingSpecialFunction: 'identify' })
    await wrapper.find('[data-test-id="device-special-function-trigger-btn"]').trigger('click')
    await wrapper.find('[data-test-id="device-reset-trigger-btn"]').trigger('click')
    expect(wrapper.emitted('triggerSpecialFunction')).toHaveLength(1)
    expect(wrapper.emitted('triggerReset')).toHaveLength(1)
  })
})
