import type { Firmware } from '@/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import vuetify from '@/plugins/vuetify'
import FirmwareList from '../FirmwareList.vue'

const OFFICIAL: Firmware = { id: 'fw-1', version: '1.5.6', kind: 'official-synced', checksum: 'x', compatibleModels: [], deprecated: false }
const CUSTOM: Firmware = { id: 'fw-2', version: '1.0.0', kind: 'custom', checksum: 'y', compatibleModels: ['v2'], label: 'Beta', deprecated: false }

describe('firmwareList', () => {
  it('renders nothing when there is no firmware', () => {
    const wrapper = mount(FirmwareList, { props: { firmware: [] }, global: { plugins: [vuetify] } })
    expect(wrapper.find('.v-list').exists()).toBe(false)
  })

  it('lists firmware with kind and label chips', () => {
    const wrapper = mount(FirmwareList, { props: { firmware: [OFFICIAL, CUSTOM] }, global: { plugins: [vuetify] } })
    expect(wrapper.find('[data-test-id="firmware-row-fw-1"]').text()).toContain('1.5.6')
    expect(wrapper.find('[data-test-id="firmware-row-fw-1"]').text()).toContain('official')
    expect(wrapper.find('[data-test-id="firmware-row-fw-2"]').text()).toContain('Beta')
    expect(wrapper.find('[data-test-id="firmware-row-fw-2"]').text()).toContain('custom')
  })

  it('only shows a delete button for custom firmware', () => {
    const wrapper = mount(FirmwareList, { props: { firmware: [OFFICIAL, CUSTOM] }, global: { plugins: [vuetify] } })
    expect(wrapper.find('[data-test-id="firmware-delete-fw-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-test-id="firmware-delete-fw-2"]').exists()).toBe(true)
  })

  it('emits delete with the firmware id', async () => {
    const wrapper = mount(FirmwareList, { props: { firmware: [OFFICIAL, CUSTOM] }, global: { plugins: [vuetify] } })
    await wrapper.find('[data-test-id="firmware-delete-fw-2"]').trigger('click')
    expect(wrapper.emitted('delete')).toEqual([['fw-2']])
  })
})
