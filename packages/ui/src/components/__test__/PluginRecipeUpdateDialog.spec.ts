import type { usePluginsStore } from '@/stores/plugins'
import type { Plugin } from '@/types/plugin'
import type { RecipeUpdatePreview, UpdateItem } from '@/types/recipeUpdate'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '../../plugins/vuetify'
import { RecipeUpdateConflictError } from '../../stores/plugins'
import { stubVisualViewport } from '../../test/browser'
import { asStore } from '../../test/mockStore'
import PluginRecipeUpdateDialog from '../PluginRecipeUpdateDialog.vue'

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

let pluginsStoreMock: ReturnType<typeof usePluginsStore>
vi.mock('@/stores/plugins', async () => {
  const actual = await vi.importActual<typeof import('../../stores/plugins')>('../../stores/plugins')
  return {
    ...actual,
    usePluginsStore: () => pluginsStoreMock,
  }
})

const basePlugin: Plugin = {
  id: 'plugin-1',
  name: 'Weather',
  kind: 'Poll',
  refreshInterval: 15,
  createdAt: new Date(),
  updatedAt: new Date(),
  sourceRecipeId: 'recipe-1',
}

function nameItem(overrides: Partial<UpdateItem> = {}): UpdateItem {
  return { kind: 'changed', conflict: false, itemType: 'name', key: 'name', local: 'Weather', upstream: 'Weather Pro', ...overrides }
}

function fieldItem(overrides: Partial<UpdateItem> = {}): UpdateItem {
  return {
    kind: 'added',
    conflict: false,
    itemType: 'field',
    key: 'api_key',
    upstream: { keyname: 'api_key', fieldType: 'string', name: 'API Key', description: null, defaultValue: null, required: true, order: 0 },
    ...overrides,
  }
}

function preview(overrides: Partial<RecipeUpdatePreview> = {}): RecipeUpdatePreview {
  return {
    contentHash: 'hash-1',
    mode: 'three-way',
    items: [nameItem()],
    assignmentsMissingRequiredField: [],
    ...overrides,
  }
}

function mountDialog(props: { preview: RecipeUpdatePreview | null, error?: string | null, modelValue?: boolean }) {
  return mount(PluginRecipeUpdateDialog, {
    props: { plugin: basePlugin, modelValue: true, error: null, ...props },
    global: { plugins: [createPinia(), vuetify] },
    attachTo: document.body,
  })
}

function checkboxFor(itemKey: string) {
  return document.querySelector(`[data-test-id="item-checkbox-${itemKey}"] input`) as HTMLInputElement
}

function findButton(text: string) {
  return Array.from(document.querySelectorAll('button')).find(btn => btn.textContent?.trim().includes(text)) as HTMLButtonElement
}

describe('pluginRecipeUpdateDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    pluginsStoreMock = asStore<ReturnType<typeof usePluginsStore>>({
      checkRecipeUpdate: vi.fn(),
      applyRecipeUpdate: vi.fn(),
    })
  })

  it('checks non-conflict items and leaves conflicts unchecked by default in three-way mode', () => {
    const changed = nameItem({ conflict: false })
    const conflicted = fieldItem({ kind: 'changed', conflict: true, local: { keyname: 'api_key', fieldType: 'string', name: 'Key', description: null, defaultValue: null, required: true, order: 0 }, upstream: { keyname: 'api_key', fieldType: 'string', name: 'API Key', description: null, defaultValue: null, required: true, order: 0 } })
    mountDialog({ preview: preview({ items: [changed, conflicted] }) })

    expect(checkboxFor('name:name').checked).toBe(true)
    expect(checkboxFor('field:api_key').checked).toBe(false)
  })

  it('unchecks everything and shows the two-way banner in two-way mode', () => {
    mountDialog({ preview: preview({ mode: 'two-way', items: [nameItem()] }) })

    expect(checkboxFor('name:name').checked).toBe(false)
    expect(document.querySelector('[data-test-id="recipe-update-two-way-banner"]')).not.toBeNull()
    expect(document.body.textContent).toContain('no Recipe Snapshot')
  })

  it('shows the error inline and offers only Close when the preview failed', () => {
    mountDialog({ preview: null, error: 'Failed to download Recipe archive' })

    expect(document.querySelector('[data-test-id="recipe-update-error"]')?.textContent).toContain('Failed to download Recipe archive')
    expect(document.querySelector('[data-test-id="recipe-update-apply"]')).toBeNull()
    expect(findButton('Close')).toBeTruthy()
  })

  it('shows "Up to date" with zero items in three-way mode and hides the apply button', () => {
    mountDialog({ preview: preview({ items: [] }) })

    expect(document.querySelector('[data-test-id="recipe-update-up-to-date"]')?.textContent).toContain('Up to date')
    expect(document.querySelector('[data-test-id="recipe-update-apply"]')).toBeNull()
  })

  it('offers "Save baseline" with zero items in two-way mode', () => {
    mountDialog({ preview: preview({ mode: 'two-way', items: [] }) })

    expect(document.querySelector('[data-test-id="recipe-update-up-to-date"]')?.textContent).toContain('Up to date')
    const applyButton = document.querySelector('[data-test-id="recipe-update-apply"]') as HTMLButtonElement
    expect(applyButton.textContent).toContain('Save baseline')
  })

  it('sends exactly the checked items plus the contentHash when applying', async () => {
    pluginsStoreMock.applyRecipeUpdate = vi.fn().mockResolvedValue({ ...basePlugin, name: 'Weather Pro' })
    const changed = nameItem()
    const unselectedField = fieldItem({ conflict: true })
    const wrapper = mountDialog({ preview: preview({ items: [changed, unselectedField] }) })

    expect(checkboxFor('field:api_key').checked).toBe(false)
    await findButton('Apply selected').click()
    await flushPromises()

    expect(pluginsStoreMock.applyRecipeUpdate).toHaveBeenCalledWith('plugin-1', {
      contentHash: 'hash-1',
      apply: [{ itemType: 'name', key: 'name' }],
    })
    expect(wrapper.emitted('applied')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toContainEqual([false])
  })

  it('labels the apply button "Save baseline" when nothing is checked', async () => {
    mountDialog({ preview: preview({ mode: 'two-way', items: [nameItem()] }) })

    const applyButton = document.querySelector('[data-test-id="recipe-update-apply"]') as HTMLButtonElement
    expect(applyButton.textContent).toContain('Save baseline')
  })

  it('shows "Check again" on a 409 and re-runs the preview', async () => {
    pluginsStoreMock.applyRecipeUpdate = vi.fn().mockRejectedValue(new RecipeUpdateConflictError('stale'))
    const refreshed = preview({ items: [] })
    pluginsStoreMock.checkRecipeUpdate = vi.fn().mockResolvedValue(refreshed)
    mountDialog({ preview: preview({ items: [nameItem()] }) })

    await findButton('Apply selected').click()
    await flushPromises()

    expect(document.querySelector('[data-test-id="recipe-update-conflict"]')?.textContent).toContain('The Recipe changed since you previewed')

    await findButton('Check again').click()
    await flushPromises()

    expect(pluginsStoreMock.checkRecipeUpdate).toHaveBeenCalledWith('plugin-1')
    expect(document.querySelector('[data-test-id="recipe-update-conflict"]')).toBeNull()
    expect(document.querySelector('[data-test-id="recipe-update-up-to-date"]')).not.toBeNull()
  })

  it('warns about assignments missing a required field when the field item is checked', () => {
    const added = fieldItem()
    mountDialog({
      preview: preview({
        items: [added],
        assignmentsMissingRequiredField: [{ key: 'api_key', assignments: [{ deviceId: 'd1', deviceName: 'Device One' }] }],
      }),
    })

    expect(document.querySelector('[data-test-id="recipe-update-missing-field-warning"]')?.textContent).toContain('Device One')
  })

  it('closes without persisting on Dismiss', async () => {
    const wrapper = mountDialog({ preview: preview() })

    await findButton('Dismiss').click()

    expect(pluginsStoreMock.applyRecipeUpdate).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:modelValue')).toContainEqual([false])
  })
})
