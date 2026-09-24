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
    const vm = wrapper.vm

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
    const vm = wrapper.vm

    vm.dataSources[0].mode = 'literal'
    vm.onModeChange(vm.dataSources[0])
    await wrapper.vm.$nextTick()

    expect(vm.dataSources[0].url).toBeUndefined()
    expect(vm.dataSources[0].method).toBeUndefined()
    expect(vm.dataSources[0].headers).toBeUndefined()
    expect(vm.dataSources[0].headersJson).toBe('')
  })

  it('clears body and transform when switching a source to literal mode', async () => {
    const source: EditableDataSource = { name: 'gh', mode: 'fetch', method: 'POST', url: 'https://api.github.com/graphql', body: { query: '{ viewer { login } }' }, bodyJson: '{"query":"{ viewer { login } }"}', transformJs: 'module.exports = function (data) { return data }' }
    const wrapper = mountEditor([source])
    const vm = wrapper.vm

    vm.dataSources[0].mode = 'literal'
    vm.onModeChange(vm.dataSources[0])
    await wrapper.vm.$nextTick()

    expect(vm.dataSources[0].body).toBeUndefined()
    expect(vm.dataSources[0].bodyJson).toBe('')
    expect(vm.dataSources[0].transformJs).toBeUndefined()
  })

  it('seeds an empty bodyJson on a new data source', async () => {
    const wrapper = mountEditor([])
    const vm = wrapper.vm

    vm.addDataSource()
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('update:modelValue')!
    expect(emitted.at(-1)![0]).toEqual([
      expect.objectContaining({ headersJson: '', bodyJson: '' }),
    ])
  })

  it('parses bodyJson into body on sync', () => {
    const source: EditableDataSource = { name: 'gh', mode: 'fetch', bodyJson: '' }
    const wrapper = mountEditor([source])
    const vm = wrapper.vm

    vm.dataSources[0].bodyJson = '{"query":"{ viewer { login } }"}'
    vm.syncBody(vm.dataSources[0])

    expect(vm.dataSources[0].body).toEqual({ query: '{ viewer { login } }' })
  })

  it('keeps the last valid body while the JSON is being typed and invalid', () => {
    const source: EditableDataSource = { name: 'gh', mode: 'fetch', body: { query: 'a' }, bodyJson: '{"query":"a"}' }
    const wrapper = mountEditor([source])
    const vm = wrapper.vm

    vm.dataSources[0].bodyJson = '{"query": incomplete'
    vm.syncBody(vm.dataSources[0])

    expect(vm.dataSources[0].body).toEqual({ query: 'a' })
  })

  it('resets body to empty when bodyJson is cleared', () => {
    const source: EditableDataSource = { name: 'gh', mode: 'fetch', body: { query: 'a' }, bodyJson: '{"query":"a"}' }
    const wrapper = mountEditor([source])
    const vm = wrapper.vm

    vm.dataSources[0].bodyJson = '   '
    vm.syncBody(vm.dataSources[0])

    expect(vm.dataSources[0].body).toEqual({})
  })

  it('renders body and transform inputs for a fetch source', async () => {
    const source: EditableDataSource = { name: 'gh', mode: 'fetch', method: 'POST', url: 'https://api.github.com/graphql', bodyJson: '{"query":"a"}', transformJs: 'module.exports = function (data) { return data }' }
    const wrapper = mountEditor([source])

    await wrapper.find('.v-expansion-panel-title').trigger('click')
    await wrapper.vm.$nextTick()

    const textareas = wrapper.findAll('textarea').map(el => (el.element as HTMLTextAreaElement).value)
    expect(textareas).toContain('{"query":"a"}')
    expect(textareas).toContain('module.exports = function (data) { return data }')
  })

  it('restores a default method and clears the literal value when switching a source back to fetch mode', async () => {
    const source: EditableDataSource = { name: 'title', mode: 'literal', literalValue: { text: 'Hi' }, literalValueJson: '{"text":"Hi"}' }
    const wrapper = mountEditor([source])
    const vm = wrapper.vm

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
    const vm = wrapper.vm

    vm.dataSources[0].literalValueJson = '{"text":"Hello"}'
    vm.syncLiteralValue(vm.dataSources[0])

    expect(vm.dataSources[0].literalValue).toEqual({ text: 'Hello' })
  })

  it('keeps the last valid literalValue while the JSON is being typed and invalid', () => {
    const source: EditableDataSource = { name: 'title', mode: 'literal', literalValue: { text: 'Hello' }, literalValueJson: '{"text":"Hello"}' }
    const wrapper = mountEditor([source])
    const vm = wrapper.vm

    vm.dataSources[0].literalValueJson = '{"text": incomplete'
    vm.syncLiteralValue(vm.dataSources[0])

    expect(vm.dataSources[0].literalValue).toEqual({ text: 'Hello' })
  })

  it('removes a data source', async () => {
    const wrapper = mountEditor([
      { name: 'one', mode: 'fetch' },
      { name: 'two', mode: 'fetch' },
    ])
    const vm = wrapper.vm

    vm.removeDataSource(0)
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('update:modelValue')!
    expect(emitted.at(-1)![0]).toEqual([expect.objectContaining({ name: 'two' })])
  })
})
