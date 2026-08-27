import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useDeviceRenderContext } from '../useDeviceRenderContext'

const customModel = { name: 'custom', label: 'Custom', width: 1200, height: 825, colors: 4, bitDepth: 2, scaleFactor: 1, rotation: 0, offsetX: 0, offsetY: 0, mimeType: 'image/png', kind: 'trmnl', paletteIds: [], cssClasses: [], cssVariables: {}, deprecated: false }

vi.mock('@/stores/device', () => ({
  useDeviceStore: vi.fn(() => ({
    getById: vi.fn((id: string) => (id === 'device1' ? { id: 'device1', deviceModel: customModel, palette: { id: 'p', name: 'p', grays: 4, frameworkClass: 'x', deprecated: false } } : undefined)),
  })),
}))

describe('useDeviceRenderContext', () => {
  it('resolves the device for the given id and exposes a render target and the screens store', () => {
    setActivePinia(createPinia())

    const { device, renderTarget, screensStore } = useDeviceRenderContext(() => 'device1')

    expect(device.value?.id).toBe('device1')
    expect(renderTarget.value.model.width).toBe(1200)
    expect(screensStore).toBeDefined()
  })

  it('tracks changes to the underlying device id', () => {
    setActivePinia(createPinia())
    const currentId = ref('device1')

    const { device } = useDeviceRenderContext(() => currentId.value)
    expect(device.value?.id).toBe('device1')

    currentId.value = 'missing'
    expect(device.value).toBeUndefined()
  })
})
