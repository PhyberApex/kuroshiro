import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import vuetify from '../../plugins/vuetify'
import PluginTemplateEditor from '../PluginTemplateEditor.vue'

function mountEditor(modelValue: string) {
  return mount(PluginTemplateEditor, {
    props: { modelValue },
    global: { plugins: [vuetify] },
  })
}

describe('pluginTemplateEditor', () => {
  it('shows the liquid markup in the textarea', () => {
    const wrapper = mountEditor('<div>{{ data.title }}</div>')
    expect(wrapper.get('textarea').element.value).toBe('<div>{{ data.title }}</div>')
  })

  it('emits update:modelValue as the textarea changes', async () => {
    const wrapper = mountEditor('')
    await wrapper.get('textarea').setValue('<div>hi</div>')
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual(['<div>hi</div>'])
  })

  it('keeps the template help hidden until toggled', async () => {
    const wrapper = mountEditor('')
    expect(wrapper.get('.v-card').attributes('style')).toContain('display: none')

    await wrapper.get('button').trigger('click')

    expect(wrapper.get('.v-card').attributes('style') ?? '').not.toContain('display: none')
    expect(wrapper.text()).toContain('Liquid Template Syntax')
  })
})
