import type { EditableDataSource } from '../PluginDataSourcesEditor.vue'
import { mount } from '@vue/test-utils'
import rop from 'resize-observer-polyfill'
import { describe, expect, it } from 'vitest'
import vuetify from '../../plugins/vuetify'
import PluginDataSourcesEditor from '../PluginDataSourcesEditor.vue'

globalThis.ResizeObserver = rop

function mountEditor(dataSources: EditableDataSource[]) {
  return mount(PluginDataSourcesEditor, {
    props: { modelValue: dataSources },
    global: { plugins: [vuetify] },
  })
}

describe('pluginDataSourcesEditor', () => {
  it('adds a new data source defaulting to fetch mode', async () => {
    const wrapper = mountEditor([])
    const vm = wrapper.vm as any

    vm.addDataSource()
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('update:modelValue')!
    expect(emitted.at(-1)![0]).toEqual([
      expect.objectContaining({ name: '', mode: 'fetch', method: 'GET', url: '' }),
    ])
  })

  it('clears fetch fields when switching a source to literal mode', async () => {
    const source: EditableDataSource = { name: 'weather', mode: 'fetch', method: 'GET', url: 'https://api.example.com', headers: { A: 'b' }, headersJson: '{"A":"b"}' }
    const wrapper = mountEditor([source])
    const vm = wrapper.vm as any

    vm.dataSources[0].mode = 'literal'
    vm.onModeChange(vm.dataSources[0])
    await wrapper.vm.$nextTick()

    expect(vm.dataSources[0].url).toBeUndefined()
    expect(vm.dataSources[0].method).toBeUndefined()
    expect(vm.dataSources[0].headers).toBeUndefined()
    expect(vm.dataSources[0].headersJson).toBe('')
  })

  it('restores a default method and clears the literal value when switching a source back to fetch mode', async () => {
    const source: EditableDataSource = { name: 'title', mode: 'literal', literalValue: { text: 'Hi' }, literalValueJson: '{"text":"Hi"}' }
    const wrapper = mountEditor([source])
    const vm = wrapper.vm as any

    vm.dataSources[0].mode = 'fetch'
    vm.onModeChange(vm.dataSources[0])
    await wrapper.vm.$nextTick()

    expect(vm.dataSources[0].method).toBe('GET')
    expect(vm.dataSources[0].literalValue).toBeUndefined()
    expect(vm.dataSources[0].literalValueJson).toBe('')
  })

  it('parses literalValueJson into literalValue on sync', () => {
    const source: EditableDataSource = { name: 'title', mode: 'literal', literalValueJson: '' }
    const wrapper = mountEditor([source])
    const vm = wrapper.vm as any

    vm.dataSources[0].literalValueJson = '{"text":"Hello"}'
    vm.syncLiteralValue(vm.dataSources[0])

    expect(vm.dataSources[0].literalValue).toEqual({ text: 'Hello' })
  })

  it('keeps the last valid literalValue while the JSON is being typed and invalid', () => {
    const source: EditableDataSource = { name: 'title', mode: 'literal', literalValue: { text: 'Hello' }, literalValueJson: '{"text":"Hello"}' }
    const wrapper = mountEditor([source])
    const vm = wrapper.vm as any

    vm.dataSources[0].literalValueJson = '{"text": incomplete'
    vm.syncLiteralValue(vm.dataSources[0])

    expect(vm.dataSources[0].literalValue).toEqual({ text: 'Hello' })
  })

  it('removes a data source', async () => {
    const wrapper = mountEditor([
      { name: 'one', mode: 'fetch' },
      { name: 'two', mode: 'fetch' },
    ])
    const vm = wrapper.vm as any

    vm.removeDataSource(0)
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('update:modelValue')!
    expect(emitted.at(-1)![0]).toEqual([expect.objectContaining({ name: 'two' })])
  })
})
