import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import vuetify from '@/plugins/vuetify'
import DeviceModelPaletteSection from '../DeviceModelPaletteSection.vue'

function mountSection(props: Partial<InstanceType<typeof DeviceModelPaletteSection>['$props']> = {}) {
  return mount(DeviceModelPaletteSection, {
    props: {
      modelOptions: [{ title: 'TRMNL OG (800x480)', value: 'og_plus' }],
      paletteOptions: [{ title: '4 Grays (2-bit)', value: 'gray-4' }],
      paletteDisabled: false,
      deprecatedAssigned: false,
      selectedModelName: null,
      selectedPaletteId: null,
      ...props,
    },
    global: { plugins: [vuetify] },
  })
}

describe('deviceModelPaletteSection', () => {
  it('shows a deprecated chip only when the assigned model is deprecated', () => {
    expect(mountSection().text()).not.toContain('no longer exists upstream')
    expect(mountSection({ deprecatedAssigned: true }).text()).toContain('no longer exists upstream')
  })

  it('disables the palette select when there is no resolved model', () => {
    const wrapper = mountSection({ paletteDisabled: true })
    expect(wrapper.find('[data-test-id="device-palette-select"] input').attributes('disabled')).toBeDefined()
  })

  it('renders the model and palette selects', () => {
    const wrapper = mountSection()
    expect(wrapper.find('[data-test-id="device-model-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="device-palette-select"]').exists()).toBe(true)
  })
})
