import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import vuetify from '@/plugins/vuetify'
import CleanupActionsCard from '../CleanupActionsCard.vue'

function mountCard(props: Partial<InstanceType<typeof CleanupActionsCard>['$props']> = {}) {
  return mount(CleanupActionsCard, {
    props: {
      selectedCount: 3,
      totalSelectedSize: 2048,
      dryRun: true,
      cleanupInProgress: false,
      ...props,
    },
    global: { plugins: [vuetify] },
  })
}

describe('cleanupActionsCard', () => {
  it('shows the selected count and space to be freed', () => {
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('Selected items:')
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('2 KB')
  })

  it('labels the button Preview Cleanup during a dry run', () => {
    const wrapper = mountCard({ dryRun: true })
    expect(wrapper.text()).toContain('Preview Cleanup')
  })

  it('labels the button Clean Selected outside a dry run', () => {
    const wrapper = mountCard({ dryRun: false })
    expect(wrapper.text()).toContain('Clean Selected')
  })

  it('emits confirmCleanup when the action button is clicked', async () => {
    const wrapper = mountCard()
    const btn = wrapper.findAll('button').find(b => b.text().includes('Preview Cleanup'))
    await btn?.trigger('click')
    expect(wrapper.emitted('confirmCleanup')).toHaveLength(1)
  })

  it('emits selectAll and deselectAll', async () => {
    const wrapper = mountCard()
    const selectAllBtn = wrapper.findAll('button').find(b => b.text() === 'Select All')
    const deselectAllBtn = wrapper.findAll('button').find(b => b.text() === 'Deselect All')
    await selectAllBtn?.trigger('click')
    await deselectAllBtn?.trigger('click')
    expect(wrapper.emitted('selectAll')).toHaveLength(1)
    expect(wrapper.emitted('deselectAll')).toHaveLength(1)
  })

  it('updates dryRun via v-model when the switch is toggled', async () => {
    const wrapper = mountCard({ dryRun: true })
    await wrapper.find('input[type="checkbox"]').setValue(false)
    expect(wrapper.emitted('update:dryRun')).toEqual([[false]])
  })
})
