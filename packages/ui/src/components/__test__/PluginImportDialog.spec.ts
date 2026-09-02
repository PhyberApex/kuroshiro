import type { Mock } from 'vitest'
import type { useDeviceStore } from '@/stores/device'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VFileInput, VSelect } from 'vuetify/components'
import vuetify from '../../plugins/vuetify'
import { stubVisualViewport } from '../../test/browser'
import { jsonResponse, stubFetch } from '../../test/fetch'
import { asStore } from '../../test/mockStore'
import PluginImportDialog from '../PluginImportDialog.vue'

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

let deviceStoreMock: ReturnType<typeof useDeviceStore>
vi.mock('@/stores/device', () => ({
  useDeviceStore: () => deviceStoreMock,
}))

function mountDialog() {
  return mount(PluginImportDialog, {
    props: { modelValue: true },
    global: { plugins: [createPinia(), vuetify] },
    attachTo: document.body,
  })
}

function setInput(testId: string, value: string) {
  const input = document.querySelector(`[data-test-id="${testId}"] input`) as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input'))
  return flushPromises()
}

async function selectDevice(wrapper: ReturnType<typeof mountDialog>, deviceId: string) {
  await wrapper.findComponent(VSelect).vm.$emit('update:modelValue', deviceId)
}

function clickImport() {
  const button = document.querySelector('[data-test-id="import-submit"]') as HTMLElement
  button.click()
  return flushPromises()
}

function clickTab(value: string) {
  const tab = document.querySelector(`[value="${value}"]`) as HTMLElement
  tab.click()
  return flushPromises()
}

describe('pluginImportDialog', () => {
  let mockFetch: Mock<typeof fetch>

  beforeEach(() => {
    document.body.innerHTML = ''
    deviceStoreMock = asStore<ReturnType<typeof useDeviceStore>>({
      devices: [{ id: 'device-1', name: 'Device 1' }],
    })
    mockFetch = stubFetch()
  })

  it('imports from a GitHub URL for the selected device', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}))
    const wrapper = mountDialog()
    await flushPromises()

    await clickTab('github')
    await flushPromises()
    await setInput('github-url', 'https://github.com/owner/repo')
    await selectDevice(wrapper, 'device-1')

    await clickImport()

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/plugins/import-github', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ githubUrl: 'https://github.com/owner/repo', deviceId: 'device-1' }),
    }))
    expect(wrapper.emitted('imported')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toContainEqual([false])
  })

  it('imports from a TRMNL recipe id for the selected device', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}))
    const wrapper = mountDialog()
    await flushPromises()

    await clickTab('recipe')
    await flushPromises()
    await setInput('recipe-id', '150460')
    await selectDevice(wrapper, 'device-1')

    await clickImport()

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/plugins/import-recipe', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipeId: '150460', deviceId: 'device-1' }),
    }))
    expect(wrapper.emitted('imported')).toHaveLength(1)
  })

  it('imports a file for the selected device', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}))
    const wrapper = mountDialog()
    await flushPromises()

    await selectDevice(wrapper, 'device-1')
    await wrapper.findComponent(VFileInput).vm.$emit('update:model-value', [new File(['content'], 'plugin.zip')])

    await clickImport()

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/plugins/import', expect.objectContaining({ method: 'POST' }))
    const [, init] = mockFetch.mock.calls[0]
    expect(init?.body).toBeInstanceOf(FormData)
    expect(wrapper.emitted('imported')).toHaveLength(1)
  })

  it('requires the active tab\'s own field even if a leftover value from another tab enabled the button', async () => {
    // The recipe tab was filled in first, which enables Import; switching to the (still
    // empty) github tab must still fail with a github-specific message, not silently
    // import the leftover recipe.
    const wrapper = mountDialog()
    await flushPromises()

    await clickTab('recipe')
    await flushPromises()
    await setInput('recipe-id', '150460')
    await clickTab('github')
    await flushPromises()
    await selectDevice(wrapper, 'device-1')

    await clickImport()

    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(document.querySelector('[data-test-id="import-error"]')?.textContent).toContain('Please enter a GitHub URL')
    expect(wrapper.emitted('imported')).toBeUndefined()
  })

  it('shows the error the API rejected the import with', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ message: 'Repository not found' }, false))
    const wrapper = mountDialog()
    await flushPromises()

    await clickTab('github')
    await flushPromises()
    await setInput('github-url', 'https://github.com/owner/repo')
    await selectDevice(wrapper, 'device-1')

    await clickImport()

    expect(document.querySelector('[data-test-id="import-error"]')?.textContent).toContain('Repository not found')
    expect(wrapper.emitted('imported')).toBeUndefined()
  })

  it('resets its fields when cancelled', async () => {
    const wrapper = mountDialog()
    await flushPromises()

    await clickTab('github')
    await flushPromises()
    await setInput('github-url', 'https://github.com/owner/repo')

    const cancelBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent?.trim() === 'Cancel') as HTMLElement
    cancelBtn.click()
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')).toContainEqual([false])
  })
})
