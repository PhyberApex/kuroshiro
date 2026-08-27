import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import vuetify from '@/plugins/vuetify'
import DeviceFirmwareSection from '../DeviceFirmwareSection.vue'

function mountSection(props: Partial<InstanceType<typeof DeviceFirmwareSection>['$props']> = {}) {
  return mount(DeviceFirmwareSection, {
    props: {
      firmwareOptions: [{ title: '1.5.6 (official)', value: 'fw-1' }],
      firmwareUpdating: false,
      fwVersion: undefined,
      updatePending: false,
      selectedFirmwareId: null,
      ...props,
    },
    global: { plugins: [vuetify] },
  })
}

describe('deviceFirmwareSection', () => {
  it('shows N/A when no firmware version was reported', () => {
    expect(mountSection().text()).toContain('Reported: N/A')
    expect(mountSection({ fwVersion: '1.5.6' }).text()).toContain('Reported: 1.5.6')
  })

  it('disables the update button until a firmware is selected', () => {
    expect(mountSection().find('[data-test-id="device-firmware-update-btn"]').attributes('disabled')).toBeDefined()
    expect(mountSection({ selectedFirmwareId: 'fw-1' }).find('[data-test-id="device-firmware-update-btn"]').attributes('disabled')).toBeUndefined()
  })

  it('shows the update pending chip only when updatePending is true', () => {
    expect(mountSection().text()).not.toContain('Update pending')
    expect(mountSection({ updatePending: true }).text()).toContain('Update pending')
  })

  it('emits triggerFirmwareUpdate when the update button is clicked', async () => {
    const wrapper = mountSection({ selectedFirmwareId: 'fw-1' })
    await wrapper.find('[data-test-id="device-firmware-update-btn"]').trigger('click')
    expect(wrapper.emitted('triggerFirmwareUpdate')).toHaveLength(1)
  })
})
