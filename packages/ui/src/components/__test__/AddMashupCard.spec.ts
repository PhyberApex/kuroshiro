import type { useMashupStore } from '@/stores/mashup'
import type { usePluginsStore } from '@/stores/plugins'
import type { useScreensStore } from '@/stores/screens'
import type { Plugin } from '@/types/plugin'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '../../plugins/vuetify'
import { asStore } from '../../test/mockStore'
import AddMashupCard from '../AddMashupCard.vue'

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

let pluginsStoreMock: ReturnType<typeof usePluginsStore>
let mashupStoreMock: ReturnType<typeof useMashupStore>
let screensStoreMock: ReturnType<typeof useScreensStore>
let allPlugins: Plugin[]

vi.mock('@/stores/plugins', () => ({
  usePluginsStore: () => pluginsStoreMock,
}))
vi.mock('@/stores/mashup', () => ({
  useMashupStore: () => mashupStoreMock,
}))
vi.mock('@/stores/screens', () => ({
  useScreensStore: () => screensStoreMock,
}))

function makePlugin(id: string, assignedDeviceIds: string[] = []): Plugin {
  return {
    id,
    name: `Plugin ${id}`,
    kind: 'Poll',
    refreshInterval: 15,
    createdAt: new Date(),
    updatedAt: new Date(),
    deviceAssignments: assignedDeviceIds.map(deviceId => ({
      id: `assignment-${id}-${deviceId}`,
      isActive: true,
      order: 0,
      device: { id: deviceId, name: `Device ${deviceId}` },
    })),
  }
}

function mountCard() {
  return mount(AddMashupCard, {
    props: { deviceId: 'device-1' },
    global: {
      plugins: [createPinia(), vuetify],
    },
  })
}

describe('addMashupCard', () => {
  beforeEach(() => {
    allPlugins = []
    pluginsStoreMock = asStore<ReturnType<typeof usePluginsStore>>({
      fetchAllPlugins: vi.fn(async () => allPlugins),
    })
    mashupStoreMock = asStore<ReturnType<typeof useMashupStore>>({
      create: vi.fn(async () => ({})),
    })
    screensStoreMock = asStore<ReturnType<typeof useScreensStore>>({
      fetchScreensForDevice: vi.fn(async () => {}),
    })
  })

  it('offers every plugin in the system, including ones unassigned or assigned to other devices', async () => {
    allPlugins = [
      makePlugin('unassigned'),
      makePlugin('elsewhere', ['device-2']),
      makePlugin('here', ['device-1']),
    ]
    const wrapper = mountCard()
    await flushPromises()

    expect(pluginsStoreMock.fetchAllPlugins).toHaveBeenCalled()
    expect(wrapper.vm.availablePlugins.map(p => p.value)).toEqual(['unassigned', 'elsewhere', 'here'])
  })

  it('does not show the empty state when the device has no assigned plugins but plugins exist elsewhere', async () => {
    allPlugins = [makePlugin('elsewhere', ['device-2'])]
    const wrapper = mountCard()
    await flushPromises()

    expect(wrapper.text()).not.toContain('No plugins available')
  })

  it('shows the empty state only when there are zero plugins in the system', async () => {
    allPlugins = []
    const wrapper = mountCard()
    await flushPromises()

    expect(wrapper.text()).toContain('No plugins available')
    expect(wrapper.text()).not.toContain('assign plugins to this device')
  })
})
