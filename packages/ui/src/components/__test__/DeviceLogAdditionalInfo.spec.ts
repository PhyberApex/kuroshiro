import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import vuetify from '../../plugins/vuetify'
import DeviceLogAdditionalInfo from '../DeviceLogAdditionalInfo.vue'

describe('deviceLogAdditionalInfo', () => {
  it('renders each key/value pair', () => {
    const wrapper = mount(DeviceLogAdditionalInfo, {
      props: { info: { retries: 0, note: 'ok' } },
      global: { plugins: [vuetify] },
    })

    expect(wrapper.text()).toContain('retries')
    expect(wrapper.text()).toContain('note')
    expect(wrapper.text()).toContain('ok')
  })

  it('falls back to an em dash for falsy values', () => {
    const wrapper = mount(DeviceLogAdditionalInfo, {
      props: { info: { retries: 0 } },
      global: { plugins: [vuetify] },
    })

    expect(wrapper.text()).toContain('—')
  })
})
