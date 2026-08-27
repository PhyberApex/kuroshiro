import type { DeviceModel, Palette } from '@/types'
import type { RenderTarget } from '@/utils/screenShell'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MODEL, DEFAULT_PALETTE } from '@/utils/renderTarget'
import vuetify from '../../plugins/vuetify'
import { stubVisualViewport } from '../../test/browser'
import PluginPreviewDialog from '../PluginPreviewDialog.vue'

const OG: DeviceModel = { ...DEFAULT_MODEL, paletteIds: ['bw'] }
const BW: Palette = { ...DEFAULT_PALETTE, id: 'bw' }

vi.mock('@/stores/deviceModels', () => ({
  useDeviceModelsStore: () => ({
    ensureLoaded: vi.fn(),
    activeModels: [OG],
    getByName: () => OG,
    palettesFor: () => [BW],
  }),
}))

globalThis.ResizeObserver = rop
globalThis.visualViewport = globalThis.visualViewport || stubVisualViewport()

function mountDialog(props: {
  show?: boolean
  tab?: string
  target?: RenderTarget
  html?: string
  data?: Record<string, unknown> | null
  error?: string
} = {}) {
  return mount(PluginPreviewDialog, {
    props: {
      show: props.show ?? true,
      tab: props.tab ?? 'rendered',
      target: props.target ?? { model: OG, palette: BW },
      html: props.html ?? '',
      data: props.data ?? null,
      error: props.error ?? '',
    },
    global: { plugins: [createPinia(), vuetify] },
    attachTo: document.body,
  })
}

// VDialog teleports its content to the body, out of the wrapper's reach.
describe('pluginPreviewDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('shows the preview error when set', async () => {
    mountDialog({ error: 'Preview failed: boom' })
    await flushPromises()
    expect(document.body.textContent).toContain('Preview failed: boom')
  })

  it('renders the html preview inside the rendered tab', async () => {
    mountDialog({ html: '<p>hi</p>' })
    await flushPromises()
    expect(document.querySelector('iframe')).not.toBeNull()
  })

  it('renders the fetched data as JSON in the data tab', async () => {
    mountDialog({ tab: 'data', data: { title: 'hi' } })
    await flushPromises()
    expect(document.body.textContent).toContain('"title": "hi"')
  })

  it('emits update:show false when Close is clicked', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Close') as HTMLButtonElement
    closeBtn.click()
    await flushPromises()
    expect(wrapper.emitted('update:show')!.at(-1)).toEqual([false])
  })
})
