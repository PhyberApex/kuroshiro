import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import vuetify from '../../plugins/vuetify'
import NavigationDrawer from '../NavigationDrawer.vue'

// Mock the device store
vi.mock('@/stores/device', () => ({
  useDeviceStore: () => ({
    devices: [
      { id: 'device1', name: 'Test Device 1' },
      { id: 'device2', name: 'Test Device 2' },
    ],
  }),
}))
// Mock isDeviceOnline
vi.mock('@/utils/isDeviceOnline', () => ({
  isDeviceOnline: () => true,
}))

describe('navigationDrawer', () => {
  it('renders without error and shows Overview and Devices', () => {
    const wrapper = mount(NavigationDrawer, {
      global: {
        plugins: [createPinia(), vuetify],
      },
    })
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('[data-test-id="nav-overview"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="nav-devices-group"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="nav-device-device1"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="nav-device-device2"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-id="nav-device-device1"]').text()).toContain('Test Device 1')
    expect(wrapper.find('[data-test-id="nav-device-device2"]').text()).toContain('Test Device 2')
  })
})
