import { mount } from '@vue/test-utils'
import rop from 'resize-observer-polyfill'
import { describe, expect, it } from 'vitest'
import { DEFAULT_MODEL, DEFAULT_PALETTE } from '@/utils/renderTarget'
import ScreenFrame from '../ScreenFrame.vue'

globalThis.ResizeObserver = rop

describe('screenFrame', () => {
  it('renders the body inside the model shell at the model size', () => {
    const model = { ...DEFAULT_MODEL, name: 'v2', width: 1872, height: 1404, cssClasses: ['screen--v2'] }
    const wrapper = mount(ScreenFrame, { props: { body: '<div class="view view--full">hi</div>', target: { model, palette: DEFAULT_PALETTE } } })
    const iframe = wrapper.find('iframe')
    expect(iframe.attributes('width')).toBe('1872')
    expect(iframe.attributes('height')).toBe('1404')
    expect(iframe.attributes('srcdoc')).toContain('class="screen screen--v2 screen--2bit screen--landscape"')
    expect(iframe.attributes('srcdoc')).toContain('<div class="view view--full">hi</div>')
    expect(iframe.attributes('style')).toContain('transform: scale(1)')
  })
})
