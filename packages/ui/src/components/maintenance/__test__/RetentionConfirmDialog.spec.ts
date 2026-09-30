import { flushPromises, mount } from '@vue/test-utils'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it } from 'vitest'
import vuetify from '@/plugins/vuetify'
import { stubVisualViewport } from '@/test/browser'
import RetentionConfirmDialog from '../RetentionConfirmDialog.vue'

globalThis.ResizeObserver = rop
globalThis.visualViewport = globalThis.visualViewport || stubVisualViewport()

async function mountDialog(props: Partial<InstanceType<typeof RetentionConfirmDialog>['$props']> = {}) {
  const wrapper = mount(RetentionConfirmDialog, {
    props: {
      modelValue: true,
      preview: { alertsPruned: 2, deviceLogsPruned: 5 },
      confirming: false,
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

describe('retentionConfirmDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('shows the preview counts to be deleted', async () => {
    await mountDialog()
    expect(document.body.textContent).toContain('Resolved Alerts: 2')
    expect(document.body.textContent).toContain('Device Log entries: 5')
  })

  it('emits confirm when confirming', async () => {
    const wrapper = await mountDialog()
    await clickButton('Confirm Delete')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('closes via update:modelValue when cancelled', async () => {
    const wrapper = await mountDialog()
    await clickButton('Cancel')
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })
})
