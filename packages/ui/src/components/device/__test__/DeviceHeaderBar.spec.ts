import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import vuetify from '@/plugins/vuetify'
import DeviceHeaderBar from '../DeviceHeaderBar.vue'

function mountBar(props: Partial<InstanceType<typeof DeviceHeaderBar>['$props']> = {}) {
  return mount(DeviceHeaderBar, {
    props: {
      name: 'Test Device',
      online: false,
      valid: true,
      ...props,
    },
    global: { plugins: [vuetify] },
  })
}

describe('deviceHeaderBar', () => {
  it('shows the device name and a delete button', () => {
    const wrapper = mountBar()
    expect(wrapper.find('[data-test-id="device-name"]').text()).toContain('Test Device')
    expect(wrapper.find('[data-test-id="delete-device-btn"]').exists()).toBe(true)
  })

  it('switches to an editable text field and emits update:name on change', async () => {
    const wrapper = mountBar()
    await wrapper.find('[aria-label="Edit device name"]').trigger('click')
    expect(wrapper.find('[data-test-id="device-name"]').exists()).toBe(false)

    await wrapper.find('input').setValue('Renamed Device')
    expect(wrapper.emitted('update:name')).toEqual([['Renamed Device']])
  })

  it('disables the Update button when invalid', () => {
    const wrapper = mountBar({ valid: false })
    expect(wrapper.findAll('button')[1].attributes('disabled')).toBeDefined()
  })

  it('emits save and delete when their buttons are clicked', async () => {
    const wrapper = mountBar()
    await wrapper.findAll('button')[1].trigger('click')
    await wrapper.find('[data-test-id="delete-device-btn"]').trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.emitted('delete')).toHaveLength(1)
  })
})
