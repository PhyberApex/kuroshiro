import type { MaintenanceIssues } from 'kuroshiro-shared'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import vuetify from '@/plugins/vuetify'
import ScanSummaryCard from '../ScanSummaryCard.vue'

const ISSUES: MaintenanceIssues = {
  orphanedScreenFiles: [{ deviceId: 'd1', screenId: 's1', path: '/a', size: 10 }],
  orphanedDeviceDirs: [],
  brokenScreens: [{ screenId: 's2', deviceId: 'd1', filename: 'b.png', type: 'file' }, { screenId: 's3', deviceId: 'd1', filename: 'c.png', type: 'file' }],
  tempFiles: [],
  oldUploads: [],
  totalSize: 2048,
  scannedAt: '2026-01-01T00:00:00.000Z',
}

describe('scanSummaryCard', () => {
  it('shows the count for each issue category and the total size', () => {
    const wrapper = mount(ScanSummaryCard, { props: { issues: ISSUES }, global: { plugins: [vuetify] } })
    const text = wrapper.text()
    expect(text).toContain('2 KB')
    const values = wrapper.findAll('.text-h6').map(el => el.text())
    expect(values).toEqual(['1', '0', '2', '2 KB', '0', '0'])
  })

  it('shows the scan timestamp as a chip', () => {
    const wrapper = mount(ScanSummaryCard, { props: { issues: ISSUES }, global: { plugins: [vuetify] } })
    expect(wrapper.find('.v-chip').exists()).toBe(true)
  })
})
