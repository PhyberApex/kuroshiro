import type { CleanupResult } from '@/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import vuetify from '@/plugins/vuetify'
import CleanupResultAlert from '../CleanupResultAlert.vue'

const RESULT: CleanupResult = { filesDeleted: 3, dirsDeleted: 1, screensDeleted: 2, bytesFreed: 2048, errors: [] }

describe('cleanupResultAlert', () => {
  it('shows the dry run heading and stats when dryRun is true', () => {
    const wrapper = mount(CleanupResultAlert, { props: { result: RESULT, dryRun: true }, global: { plugins: [vuetify] } })
    expect(wrapper.text()).toContain('Dry Run Results (no actual changes made)')
    expect(wrapper.text()).toContain('Files deleted: 3')
    expect(wrapper.text()).toContain('Space freed: 2 KB')
  })

  it('shows the cleanup-complete heading when dryRun is false', () => {
    const wrapper = mount(CleanupResultAlert, { props: { result: RESULT, dryRun: false }, global: { plugins: [vuetify] } })
    expect(wrapper.text()).toContain('Cleanup Complete')
  })

  it('lists errors when present', () => {
    const wrapper = mount(CleanupResultAlert, { props: { result: { ...RESULT, errors: ['disk full'] }, dryRun: false }, global: { plugins: [vuetify] } })
    expect(wrapper.text()).toContain('disk full')
  })

  it('emits dismiss when the alert is closed', async () => {
    const wrapper = mount(CleanupResultAlert, { props: { result: RESULT, dryRun: false }, global: { plugins: [vuetify] } })
    await wrapper.find('.v-alert__close button').trigger('click')
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })
})
