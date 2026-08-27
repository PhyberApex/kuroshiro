import { flushPromises, mount } from '@vue/test-utils'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it } from 'vitest'
import vuetify from '@/plugins/vuetify'
import { stubVisualViewport } from '@/test/browser'
import CleanupConfirmDialog from '../CleanupConfirmDialog.vue'

globalThis.ResizeObserver = rop
globalThis.visualViewport = globalThis.visualViewport || stubVisualViewport()

async function mountDialog(props: Partial<InstanceType<typeof CleanupConfirmDialog>['$props']> = {}) {
  const wrapper = mount(CleanupConfirmDialog, {
    props: {
      modelValue: true,
      dryRun: true,
      fileCount: 2,
      dirCount: 1,
      screenCount: 3,
      totalSize: 2048,
      ...props,
    },
    attachTo: document.body,
    global: { plugins: [vuetify] },
  })
  await flushPromises()
  return wrapper
}

function clickButton(text: string) {
  const button = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === text) as HTMLElement
  button.click()
  return flushPromises()
}

describe('cleanupConfirmDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('warns that this is a dry run when dryRun is true', async () => {
    await mountDialog({ dryRun: true })
    expect(document.body.textContent).toContain('This is a dry run. No files will be deleted.')
  })

  it('warns that the action cannot be undone when dryRun is false', async () => {
    await mountDialog({ dryRun: false })
    expect(document.body.textContent).toContain('Warning: This action cannot be undone!')
  })

  it('shows the counts and total size to be deleted', async () => {
    await mountDialog()
    expect(document.body.textContent).toContain('Files: 2')
    expect(document.body.textContent).toContain('Directories: 1')
    expect(document.body.textContent).toContain('Screens: 3')
    expect(document.body.textContent).toContain('Total space: 2 KB')
  })

  it('emits confirm when confirming', async () => {
    const wrapper = await mountDialog({ dryRun: true })
    await clickButton('Preview')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('closes via update:modelValue when cancelled', async () => {
    const wrapper = await mountDialog()
    await clickButton('Cancel')
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })
})
