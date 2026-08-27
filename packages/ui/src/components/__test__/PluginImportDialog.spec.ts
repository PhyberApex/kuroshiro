import type { Mock } from 'vitest'
import type { useDeviceStore } from '@/stores/device'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VFileInput, VSelect, VTabs } from 'vuetify/components'
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

async function selectDevice(wrapper: ReturnType<typeof mountDialog>) {
  wrapper.findComponent(VSelect).vm.$emit('update:modelValue', 'device-1')
  await flushPromises()
}

async function switchTab(wrapper: ReturnType<typeof mountDialog>, tab: string) {
  wrapper.findComponent(VTabs).vm.$emit('update:modelValue', tab)
  await flushPromises()
}

function setInput(testId: string, value: string) {
  const input = document.querySelector(`[data-test-id="${testId}"] input`) as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input'))
  return flushPromises()
}

function clickButton(testId: string) {
  const button = document.querySelector(`[data-test-id="${testId}"]`) as HTMLElement
  button.click()
  return flushPromises()
}

describe('pluginImportDialog', () => {
  let mockFetch: Mock<typeof fetch>

  beforeEach(() => {
    document.body.innerHTML = ''
    mockFetch = stubFetch()
    deviceStoreMock = asStore<ReturnType<typeof useDeviceStore>>({
      devices: [{ id: 'device-1', name: 'Device 1' }],
    })
  })

  it('imports a file for the selected device', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}))
    const wrapper = mountDialog()
    await flushPromises()
    await selectDevice(wrapper)
    wrapper.findComponent(VFileInput).vm.$emit('update:modelValue', [new File(['content'], 'plugin.zip')])
    await flushPromises()

    await clickButton('import-submit')

    expect(mockFetch).toHaveBeenCalledWith('/api/plugins/import', expect.objectContaining({ method: 'POST' }))
    const body = mockFetch.mock.calls[0][1]?.body as FormData
    expect(body.get('deviceId')).toBe('device-1')
    expect((body.get('file') as File).name).toBe('plugin.zip')
    expect(wrapper.emitted('imported')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')).toContainEqual([false])
  })

  it('imports from a GitHub URL for the selected device', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}))
    const wrapper = mountDialog()
    await flushPromises()
    await selectDevice(wrapper)
    await switchTab(wrapper, 'github')
    await setInput('github-url', 'https://github.com/owner/repo')

    await clickButton('import-submit')

    expect(mockFetch).toHaveBeenCalledWith('/api/plugins/import-github', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ githubUrl: 'https://github.com/owner/repo', deviceId: 'device-1' }),
    }))
    expect(wrapper.emitted('imported')).toBeTruthy()
  })

  it('imports from a recipe id for the selected device', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}))
    const wrapper = mountDialog()
    await flushPromises()
    await selectDevice(wrapper)
    await switchTab(wrapper, 'recipe')
    await setInput('recipe-id', '150460')

    await clickButton('import-submit')

    expect(mockFetch).toHaveBeenCalledWith('/api/plugins/import-recipe', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ recipeId: '150460', deviceId: 'device-1' }),
    }))
    expect(wrapper.emitted('imported')).toBeTruthy()
  })

  it('surfaces the API error message and keeps the dialog open', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ message: 'Bad plugin' }, false))
    const wrapper = mountDialog()
    await flushPromises()
    await selectDevice(wrapper)
    await switchTab(wrapper, 'github')
    await setInput('github-url', 'https://github.com/owner/repo')

    await clickButton('import-submit')

    expect(document.body.textContent).toContain('Bad plugin')
    expect(wrapper.emitted('imported')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
