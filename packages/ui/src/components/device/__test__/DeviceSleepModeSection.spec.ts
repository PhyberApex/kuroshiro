import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import vuetify from '@/plugins/vuetify'
import DeviceSleepModeSection from '../DeviceSleepModeSection.vue'

function mountSection(props: Partial<InstanceType<typeof DeviceSleepModeSection>['$props']> = {}) {
  return mount(DeviceSleepModeSection, {
    props: {
      sleepWindowValid: true,
      sleepWindowSpansMidnight: false,
      sleepModeEnabled: false,
      sleepStartTime: '',
      sleepEndTime: '',
      sleepScreenEnabled: false,
      ...props,
    },
    global: { plugins: [vuetify] },
  })
}

describe('deviceSleepModeSection', () => {
  it('shows an error message on the time fields when the window is invalid', () => {
    const wrapper = mountSection({ sleepWindowValid: false })
    expect(wrapper.text()).toContain('Set both a start and end time to enable Sleep Mode.')
  })

  it('shows no error when the window is valid', () => {
    const wrapper = mountSection({ sleepWindowValid: true })
    expect(wrapper.text()).not.toContain('Set both a start and end time to enable Sleep Mode.')
  })

  it('shows the midnight hint only when the window spans midnight', () => {
    expect(mountSection().find('[data-test-id="sleep-window-midnight-hint"]').exists()).toBe(false)
    expect(mountSection({ sleepWindowSpansMidnight: true }).find('[data-test-id="sleep-window-midnight-hint"]').exists()).toBe(true)
  })

  it('emits update events for all four models', async () => {
    const wrapper = mountSection()
    await wrapper.find('[data-test-id="sleep-mode-switch"] input').setValue(true)
    await wrapper.find('[data-test-id="sleep-start-time"] input').setValue('22:00')
    await wrapper.find('[data-test-id="sleep-end-time"] input').setValue('06:00')
    await wrapper.find('[data-test-id="sleep-screen-switch"] input').setValue(true)

    expect(wrapper.emitted('update:sleepModeEnabled')).toEqual([[true]])
    expect(wrapper.emitted('update:sleepStartTime')).toEqual([['22:00']])
    expect(wrapper.emitted('update:sleepEndTime')).toEqual([['06:00']])
    expect(wrapper.emitted('update:sleepScreenEnabled')).toEqual([[true]])
  })
})
