import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import vuetify from '@/plugins/vuetify'
import DeviceModelsCard from '../DeviceModelsCard.vue'

function mountCard(props: Partial<InstanceType<typeof DeviceModelsCard>['$props']> = {}) {
  return mount(DeviceModelsCard, {
    props: {
      activeModelCount: 3,
      deprecatedModelCount: 0,
      paletteCount: 2,
      lastSyncedAt: null,
      syncing: false,
      error: null,
      syncResult: null,
      ...props,
    },
    global: { plugins: [vuetify] },
  })
}

describe('deviceModelsCard', () => {
  it('shows the model and palette counts', () => {
    const wrapper = mountCard()
    expect(wrapper.find('[data-test-id="device-models-card"]').text()).toContain('3 models, 2 palettes')
  })

  it('shows how many models are deprecated when some are', () => {
    const wrapper = mountCard({ deprecatedModelCount: 2 })
    expect(wrapper.text()).toContain('(2 deprecated)')
  })

  it('shows never synced when there is no sync date', () => {
    const wrapper = mountCard({ lastSyncedAt: null })
    expect(wrapper.text()).toContain('never (bundled snapshot)')
  })

  it('emits sync when the sync button is clicked', async () => {
    const wrapper = mountCard()
    await wrapper.find('[data-test-id="sync-device-models-btn"]').trigger('click')
    expect(wrapper.emitted('sync')).toHaveLength(1)
  })

  it('shows the sync error over a stale success result', () => {
    const wrapper = mountCard({ error: 'boom', syncResult: { models: 1, palettes: 1, deprecatedModels: 0, deprecatedPalettes: 0, syncedAt: '2026-01-01' } })
    expect(wrapper.text()).toContain('boom')
    expect(wrapper.text()).not.toContain('Synced 1 models')
  })

  it('shows the sync result summary on success', () => {
    const wrapper = mountCard({ syncResult: { models: 4, palettes: 3, deprecatedModels: 1, deprecatedPalettes: 0, syncedAt: '2026-01-01' } })
    expect(wrapper.text()).toContain('Synced 4 models and 3 palettes')
    expect(wrapper.text()).toContain('(1 models, 0 palettes newly deprecated)')
  })

  it('emits dismissResult when the success alert is closed', async () => {
    const wrapper = mountCard({ syncResult: { models: 4, palettes: 3, deprecatedModels: 0, deprecatedPalettes: 0, syncedAt: '2026-01-01' } })
    await wrapper.find('.v-alert__close button').trigger('click')
    expect(wrapper.emitted('dismissResult')).toHaveLength(1)
  })
})
