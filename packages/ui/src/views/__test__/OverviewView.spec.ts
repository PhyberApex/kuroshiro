import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '../../plugins/vuetify'
import OverviewView from '../OverviewView.vue'

// Mock the device store
vi.mock('../../stores/device', () => {
  const devices = [
    { id: '1', friendlyId: 'Test Device', mac: 'AA:BB:CC:DD:EE:FF', apikey: 'key', mirrorEnabled: false, mirrorMac: '', mirrorApikey: '', specialFunction: '', batteryVoltage: '3.7', rssi: '-70' },
    { id: '2', friendlyId: '', mac: '11:22:33:44:55:66', apikey: 'key2', mirrorEnabled: false, mirrorMac: '', mirrorApikey: '', specialFunction: '', batteryVoltage: undefined, rssi: undefined },
  ]
  return {
    useDeviceStore: () => ({
      devices,
      fetchDevices: vi.fn(),
      addDevice: vi.fn(),
      deleteDevice: vi.fn(),
      getById: vi.fn(),
      updateDevice: vi.fn(),
    }),
  }
})

describe('overviewView', () => {
  let wrapper: ReturnType<typeof mount>
  beforeEach(() => {
    wrapper = mount(OverviewView, {
      global: {
        plugins: [createPinia(), vuetify],
      },
    })
  })

  it('renders device management info', () => {
    expect(wrapper.text()).toContain('Overview')
    expect(wrapper.text()).toContain('Add Device')
    expect(wrapper.text()).toContain('Devices')
  })

  it('renders the device list', () => {
    expect(wrapper.text()).toContain('Devices')
    expect(wrapper.text()).toContain('AA:BB:CC:DD:EE:FF')
    expect(wrapper.text()).toContain('11:22:33:44:55:66')
  })

  it('shows device details and delete button', () => {
    // Find a button with text 'Delete'
    const deleteBtns = wrapper.findAll('button')
    const found = deleteBtns.some(btn => btn.text().toLowerCase().includes('delete'))
    expect(found).toBe(true)
  })

  it('renders the add device form', () => {
    expect(wrapper.find('form').exists()).toBe(true)
    // Vuetify renders inputs with role="textbox" and label as sibling
    const textFields = wrapper.findAll('input')
    expect(textFields.length).toEqual(2)
  })

  it('disables add device button if MAC is invalid', async () => {
    const addBtn = wrapper.findAll('button').find(btn => btn.text().toLowerCase().includes('add device'))
    expect(addBtn).toBeDefined()
    expect(addBtn?.attributes('disabled')).toBeDefined()
  })

  it('shows info alert if no devices', async () => {
    vi.resetModules()
    vi.doMock('../../stores/device', () => ({
      useDeviceStore: () => ({
        devices: [],
        fetchDevices: vi.fn(),
        addDevice: vi.fn(),
        deleteDevice: vi.fn(),
        getById: vi.fn(),
        updateDevice: vi.fn(),
      }),
    }))
    const { default: DevicesViewEmpty } = await import('../../views/OverviewView.vue')
    const emptyWrapper = mount(DevicesViewEmpty, {
      global: { plugins: [createPinia(), vuetify] },
    })
    await flushPromises()
    expect(emptyWrapper.text()).toContain('No devices found.')
  })
})
