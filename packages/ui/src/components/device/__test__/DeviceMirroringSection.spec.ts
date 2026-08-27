import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import vuetify from '@/plugins/vuetify'
import DeviceMirroringSection from '../DeviceMirroringSection.vue'

function mountSection(props: Partial<InstanceType<typeof DeviceMirroringSection>['$props']> = {}) {
  return mount(DeviceMirroringSection, {
    props: {
      macRules: [(value: string) => value.length > 0 || 'required'],
      apikeyRules: [(value: string) => value.length > 0 || 'required'],
      mirrorEnabled: false,
      mirrorMac: '',
      mirrorApikey: '',
      ...props,
    },
    global: { plugins: [vuetify] },
  })
}

describe('deviceMirroringSection', () => {
  it('disables the MAC and API key fields until mirroring is enabled', () => {
    const wrapper = mountSection()
    const inputs = wrapper.findAll('input[type="text"]')
    expect(inputs.some(input => input.attributes('disabled') !== undefined)).toBe(true)
  })

  it('enables the fields once mirroring is on', () => {
    const wrapper = mountSection({ mirrorEnabled: true })
    const textInputs = wrapper.findAll('.v-text-field input')
    expect(textInputs.every(input => input.attributes('disabled') === undefined)).toBe(true)
  })

  it('emits update:mirrorMac and update:mirrorApikey on input', async () => {
    const wrapper = mountSection({ mirrorEnabled: true })
    const [macInput, apikeyInput] = wrapper.findAll('.v-text-field input')
    await macInput.setValue('AA:BB:CC:DD:EE:FF')
    await apikeyInput.setValue('secret')
    expect(wrapper.emitted('update:mirrorMac')).toEqual([['AA:BB:CC:DD:EE:FF']])
    expect(wrapper.emitted('update:mirrorApikey')).toEqual([['secret']])
  })
})
