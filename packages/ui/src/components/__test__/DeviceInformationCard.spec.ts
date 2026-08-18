import type { Device, DeviceModel, Palette } from '@/types'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '../../plugins/vuetify'
import DeviceInformationCard from '../DeviceInformationCard.vue'

const OG_PLUS: DeviceModel = {
  name: 'og_plus',
  label: 'TRMNL OG (2-bit)',
  width: 800,
  height: 480,
  colors: 4,
  bitDepth: 2,
  scaleFactor: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  mimeType: 'image/png',
  kind: 'trmnl',
  paletteIds: ['bw', 'gray-4'],
  cssClasses: [],
  cssVariables: {},
  deprecated: false,
}
const V2: DeviceModel = { ...OG_PLUS, name: 'v2', label: 'TRMNL X', width: 1872, height: 1404, paletteIds: ['gray-16', 'gray-4', 'bw'] }
const GRAY_4: Palette = { id: 'gray-4', name: '4 Grays (2-bit)', grays: 4, frameworkClass: 'screen--2bit', deprecated: false }
const GRAY_16: Palette = { id: 'gray-16', name: '16 Grays (4-bit)', grays: 16, frameworkClass: 'screen--4bit', deprecated: false }

const { mockDevice, updateDevice } = vi.hoisted(() => ({
  mockDevice: { current: null as Device | null },
  updateDevice: vi.fn(),
}))

vi.mock('@/stores/device', () => ({
  useDeviceStore: () => ({
    getById: vi.fn(() => mockDevice.current),
    deleteDevice: vi.fn(),
    updateDevice,
  }),
}))

vi.mock('@/stores/deviceModels', () => ({
  useDeviceModelsStore: () => ({
    ensureLoaded: vi.fn(),
    models: [OG_PLUS, V2],
    activeModels: [OG_PLUS, V2],
    palettes: [GRAY_4, GRAY_16],
    getByName: (name: string) => [OG_PLUS, V2].find(m => m.name === name),
    palettesFor: (model: DeviceModel | undefined) => [GRAY_4, GRAY_16].filter(p => model?.paletteIds.includes(p.id)),
  }),
}))

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

function baseDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: 'device1',
    name: 'Test Device',
    friendlyId: 'ABC123',
    mac: 'AA:BB:CC:DD:EE:FF',
    apikey: 'apikey',
    mirrorEnabled: false,
    mirrorMac: '',
    mirrorApikey: '',
    specialFunction: '',
    resetDevice: false,
    updateFirmware: false,
    lastSeen: '',
    ...overrides,
  }
}

function mountCard() {
  return mount(DeviceInformationCard, {
    props: { deviceId: 'device1' },
    global: {
      plugins: [createPinia(), vuetify],
      mocks: {
        $router: { push: vi.fn() },
      },
    },
  })
}

describe('deviceInformationCard', () => {
  beforeEach(() => {
    updateDevice.mockReset()
    mockDevice.current = baseDevice()
  })

  it('renders without error and shows device name', () => {
    const wrapper = mountCard()
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('[data-test-id="device-name"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="device-name"]').text()).toContain('Test Device')
    expect(wrapper.find('[data-test-id="delete-device-btn"]').exists()).toBe(true)
  })

  it('explains that an unassigned device renders as a TRMNL OG', () => {
    const wrapper = mountCard()
    expect(wrapper.find('[data-test-id="device-model-summary"]').text()).toContain('Not resolved yet')
    expect(wrapper.find('[data-test-id="device-model-summary"]').text()).toContain('800x480')
    expect(wrapper.find('[data-test-id="device-model-mismatch"]').exists()).toBe(false)
  })

  it('shows the assigned model with its dimensions and what the device reported', () => {
    mockDevice.current = baseDevice({ deviceModel: V2, palette: GRAY_16, reportedModel: 'x', width: 1872, height: 1404 })
    const wrapper = mountCard()
    const summary = wrapper.find('[data-test-id="device-model-summary"]').text()
    expect(summary).toContain('TRMNL X (1872x1404)')
    expect(wrapper.text()).toContain('Reported: x · 1872x1404')
    expect(wrapper.find('[data-test-id="device-model-mismatch"]').exists()).toBe(false)
  })

  it('flags a mismatch when the reported panel size differs from the assigned model', () => {
    mockDevice.current = baseDevice({ deviceModel: OG_PLUS, palette: GRAY_4, reportedModel: 'x', width: 1872, height: 1404 })
    const wrapper = mountCard()
    expect(wrapper.find('[data-test-id="device-model-mismatch"]').exists()).toBe(true)
  })

  it('sends the selected model and palette when saving', async () => {
    mockDevice.current = baseDevice({ deviceModel: OG_PLUS, palette: GRAY_4, refreshRate: 300 })
    const wrapper = mountCard()
    const vm = wrapper.vm as any
    vm.selectedModelName = 'v2'
    vm.selectedPaletteId = 'gray-16'
    await vm.saveDevice()
    expect(updateDevice).toHaveBeenCalledWith('device1', expect.objectContaining({ deviceModelName: 'v2', paletteId: 'gray-16' }))
  })

  it('drops a palette the newly selected model does not support', async () => {
    mockDevice.current = baseDevice({ deviceModel: V2, palette: GRAY_16, refreshRate: 300 })
    const wrapper = mountCard()
    const vm = wrapper.vm as any
    vm.selectedModelName = 'og_plus'
    await wrapper.vm.$nextTick()
    expect(vm.selectedPaletteId).toBeNull()
    await vm.saveDevice()
    expect(updateDevice).toHaveBeenCalledWith('device1', expect.objectContaining({ deviceModelName: 'og_plus' }))
    expect(updateDevice.mock.calls[0][1]).not.toHaveProperty('paletteId')
  })
})
