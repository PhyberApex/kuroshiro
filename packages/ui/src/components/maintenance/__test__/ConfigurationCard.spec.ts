import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it } from 'vitest'
import { VFileInput } from 'vuetify/components'
import vuetify from '@/plugins/vuetify'
import { stubVisualViewport } from '@/test/browser'
import { jsonResponse, stubFetch } from '@/test/fetch'
import ConfigurationCard from '../ConfigurationCard.vue'

globalThis.ResizeObserver = rop

globalThis.window.matchMedia = globalThis.window.matchMedia || function () {
  return {
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }
}

globalThis.visualViewport = globalThis.visualViewport || stubVisualViewport()

function mountCard() {
  return mount(ConfigurationCard, {
    global: { plugins: [createPinia(), vuetify] },
    attachTo: document.body,
  })
}

async function openImportDialog(wrapper: ReturnType<typeof mountCard>) {
  await wrapper.find('[data-test-id="import-config-btn"]').trigger('click')
  await flushPromises()
}

async function selectFile(wrapper: ReturnType<typeof mountCard>, file: File) {
  await wrapper.findComponent(VFileInput).vm.$emit('update:model-value', [file])
}

function clickImportSubmit() {
  const button = document.querySelector('[data-test-id="import-config-submit"]') as HTMLElement
  button.click()
  return flushPromises()
}

describe('configurationCard', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('downloads the export via the runtime base path and shows a snackbar', async () => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', { value: { ...originalLocation, href: '' }, writable: true })

    const wrapper = mountCard()
    await wrapper.find('[data-test-id="export-config-btn"]').trigger('click')

    expect(window.location.href).toBe('/api/config/export')
    expect(document.body.textContent).toContain('Downloading configuration export...')

    Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
  })

  it('imports the selected archive and shows the resulting summary', async () => {
    const mockFetch = stubFetch()
    mockFetch.mockResolvedValue(jsonResponse({ created: { devices: 2 }, updated: { plugins: 1 }, warnings: ['Palette "missing" was not found'] }))

    const wrapper = mountCard()
    await openImportDialog(wrapper)

    const file = new File(['zip-bytes'], 'kuroshiro-config.zip')
    await selectFile(wrapper, file)
    await clickImportSubmit()

    expect(mockFetch).toHaveBeenCalledWith('/api/config/import', expect.objectContaining({ method: 'POST' }))
    const [, init] = mockFetch.mock.calls[0]
    expect(init?.body).toBeInstanceOf(FormData)
    expect((init?.body as FormData).get('file')).toBe(file)

    expect(document.querySelector('[data-test-id="import-config-summary"]')?.textContent).toContain('Created 2, updated 1 record(s).')
    expect(document.querySelector('[data-test-id="import-config-summary"]')?.textContent).toContain('Palette "missing" was not found')
  })

  it('shows the error the API rejected the import with', async () => {
    const mockFetch = stubFetch()
    mockFetch.mockResolvedValue(jsonResponse({ message: 'Archive schemaVersion is 2, but this Kuroshiro instance expects schemaVersion 1' }, false))

    const wrapper = mountCard()
    await openImportDialog(wrapper)

    await selectFile(wrapper, new File(['zip-bytes'], 'kuroshiro-config.zip'))
    await clickImportSubmit()

    expect(document.querySelector('[data-test-id="import-config-error"]')?.textContent).toContain('Archive schemaVersion is 2')
  })

  it('disables the import button until a file is selected', async () => {
    const wrapper = mountCard()
    await openImportDialog(wrapper)

    expect(document.querySelector('[data-test-id="import-config-submit"]')?.getAttribute('disabled')).not.toBeNull()

    await selectFile(wrapper, new File(['zip-bytes'], 'kuroshiro-config.zip'))

    expect(document.querySelector('[data-test-id="import-config-submit"]')?.getAttribute('disabled')).toBeNull()
  })
})
