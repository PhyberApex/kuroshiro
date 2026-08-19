import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { DEFAULT_MODEL, DEFAULT_PALETTE } from '@/utils/renderTarget'
import ScreenFrame from '../ScreenFrame.vue'

const containerWidth = ref(0)

vi.mock('@vueuse/core', () => ({
  useElementSize: () => ({ width: containerWidth, height: ref(0) }),
}))

describe('screenFrame', () => {
  it('renders the body inside the model shell at the model size', () => {
    containerWidth.value = 0
    const model = { ...DEFAULT_MODEL, name: 'v2', width: 1872, height: 1404, cssClasses: ['screen--v2'] }
    const wrapper = mount(ScreenFrame, { props: { body: '<div class="view view--full">hi</div>', target: { model, palette: DEFAULT_PALETTE } } })
    const iframe = wrapper.find('iframe')
    expect(iframe.attributes('width')).toBe('1872')
    expect(iframe.attributes('height')).toBe('1404')
    expect(iframe.attributes('srcdoc')).toContain('class="screen screen--v2 screen--2bit"')
    expect(iframe.attributes('srcdoc')).toContain('<div class="view view--full">hi</div>')
    expect(iframe.attributes('style')).toContain('transform: scale(1)')
  })

  it('sandboxes the preview iframe to scripts only', () => {
    containerWidth.value = 0
    const model = { ...DEFAULT_MODEL, name: 'v2', width: 1872, height: 1404, cssClasses: ['screen--v2'] }
    const wrapper = mount(ScreenFrame, { props: { body: '<p>x</p>', target: { model, palette: DEFAULT_PALETTE } } })
    expect(wrapper.find('iframe').attributes('sandbox')).toBe('allow-scripts')
  })

  it('scales down to fit a narrower container using Math.min(1, containerWidth / model.width)', () => {
    containerWidth.value = 1240
    const model = { ...DEFAULT_MODEL, name: 'v2', width: 2480, height: 1860, cssClasses: ['screen--v2'] }
    const wrapper = mount(ScreenFrame, { props: { body: '<p>x</p>', target: { model, palette: DEFAULT_PALETTE } } })
    expect(wrapper.find('iframe').attributes('style')).toContain('transform: scale(0.5)')
    expect(wrapper.find('[data-test-id="screen-frame"]').attributes('style')).toContain('height: 930px')
  })

  it('does not scale up when the container is wider than the model', () => {
    containerWidth.value = 4000
    const model = { ...DEFAULT_MODEL, name: 'v2', width: 2480, height: 1860, cssClasses: ['screen--v2'] }
    const wrapper = mount(ScreenFrame, { props: { body: '<p>x</p>', target: { model, palette: DEFAULT_PALETTE } } })
    expect(wrapper.find('iframe').attributes('style')).toContain('transform: scale(1)')
    expect(wrapper.find('[data-test-id="screen-frame"]').attributes('style')).toContain('height: 1860px')
  })
})
