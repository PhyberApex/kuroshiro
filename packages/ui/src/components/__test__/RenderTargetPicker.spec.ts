import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import vuetify from '../../plugins/vuetify'
import RenderTargetPicker from '../RenderTargetPicker.vue'

const OG = { name: 'og_plus', label: 'TRMNL OG', width: 800, height: 480, paletteIds: ['bw', 'gray-4'], cssClasses: [], cssVariables: {}, rotation: 0, deprecated: false }
const V2 = { ...OG, name: 'v2', label: 'TRMNL X', width: 1872, height: 1404, paletteIds: ['gray-16', 'bw'] }
const BW = { id: 'bw', name: 'bw', grays: 2, frameworkClass: 'screen--1bit', deprecated: false }
const GRAY_4 = { id: 'gray-4', name: 'g4', grays: 4, frameworkClass: 'screen--2bit', deprecated: false }
const GRAY_16 = { id: 'gray-16', name: 'g16', grays: 16, frameworkClass: 'screen--4bit', deprecated: false }

vi.mock('@/stores/deviceModels', () => ({
  useDeviceModelsStore: () => ({
    ensureLoaded: vi.fn(),
    activeModels: [OG, V2],
    getByName: (name: string) => [OG, V2].find(m => m.name === name),
    palettesFor: (model: any) => [BW, GRAY_4, GRAY_16].filter(p => model?.paletteIds.includes(p.id)),
  }),
}))

globalThis.ResizeObserver = rop

function mountPicker(modelValue: any) {
  return mount(RenderTargetPicker, {
    props: { modelValue },
    global: { plugins: [createPinia(), vuetify] },
  })
}

describe('renderTargetPicker', () => {
  it('emits the OG model with its richest palette by default', () => {
    const wrapper = mountPicker({ model: OG, palette: GRAY_4 })
    const emitted = wrapper.emitted('update:modelValue')!
    expect(emitted[0][0]).toEqual({ model: OG, palette: GRAY_4 })
  })

  it('re-emits with the new model and drops a palette it does not support', async () => {
    const wrapper = mountPicker({ model: OG, palette: GRAY_4 })
    const vm = wrapper.vm as any
    vm.selectedPaletteId = 'gray-4'
    await wrapper.vm.$nextTick()
    vm.selectedModelName = 'v2'
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    const emitted = wrapper.emitted('update:modelValue')!
    expect(emitted.at(-1)![0]).toEqual({ model: V2, palette: GRAY_16 })
    expect(vm.selectedPaletteId).toBeNull()
  })

  it('does not leak a modelvalue attribute onto the root element', () => {
    const wrapper = mountPicker({ model: OG, palette: GRAY_4 })
    expect(wrapper.attributes('modelvalue')).toBeUndefined()
    expect(wrapper.html()).not.toContain('modelvalue')
  })

  it('seeds its selection from an incoming modelValue, shown in the selects', () => {
    const wrapper = mountPicker({ model: V2, palette: GRAY_16 })
    const vm = wrapper.vm as any
    expect(vm.selectedModelName).toBe('v2')
    expect(vm.selectedPaletteId).toBe('gray-16')
    expect(wrapper.get('[data-test-id="render-target-model"]').text()).toContain('TRMNL X')
    expect(wrapper.get('[data-test-id="render-target-palette"]').text()).toContain('g16')
  })

  it('keeps the parent-held target after being toggled out and back with v-if', async () => {
    const Host = defineComponent({
      components: { RenderTargetPicker },
      setup() {
        const target = ref({ model: OG, palette: GRAY_4 })
        const shown = ref(true)
        return { target, shown }
      },
      template: `
        <RenderTargetPicker v-if="shown" v-model="target" />
      `,
    })

    const wrapper = mount(Host, { global: { plugins: [createPinia(), vuetify] } })
    const picker = () => wrapper.findComponent(RenderTargetPicker).vm as any
    picker().selectedModelName = 'v2'
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    const targetAfterEdit = (wrapper.vm as any).target
    expect(targetAfterEdit).toEqual({ model: V2, palette: GRAY_16 })

    ;(wrapper.vm as any).shown = false
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(RenderTargetPicker).exists()).toBe(false)

    ;(wrapper.vm as any).shown = true
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as any).target).toEqual(targetAfterEdit)
    expect(picker().selectedModelName).toBe('v2')
    expect(picker().selectedPaletteId).toBe('gray-16')
  })
})
