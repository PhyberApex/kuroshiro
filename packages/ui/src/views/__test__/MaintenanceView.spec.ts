import type { useDeviceModelsStore } from '@/stores/deviceModels'
import type { useFirmwareStore } from '@/stores/firmware'
import type { useMaintenanceStore } from '@/stores/maintenance'
import type { MaintenanceIssues } from '@/types'
import { flushPromises, mount } from '@vue/test-utils'
import rop from 'resize-observer-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '@/plugins/vuetify'
import { stubVisualViewport } from '@/test/browser'
import { asStore } from '@/test/mockStore'
import MaintenanceView from '../MaintenanceView.vue'

globalThis.ResizeObserver = rop
globalThis.visualViewport = globalThis.visualViewport || stubVisualViewport()

const ISSUES: MaintenanceIssues = {
  orphanedScreenFiles: [{ deviceId: 'd1', screenId: 's1', path: '/orphaned/s1.png', size: 1024 }],
  orphanedDeviceDirs: [],
  brokenScreens: [],
  tempFiles: [],
  oldUploads: [],
  totalSize: 1024,
  scannedAt: '2026-01-01T00:00:00.000Z',
}

let maintenanceStoreMock: ReturnType<typeof useMaintenanceStore>
let deviceModelsStoreMock: ReturnType<typeof useDeviceModelsStore>
let firmwareStoreMock: ReturnType<typeof useFirmwareStore>

vi.mock('@/stores/maintenance', () => ({
  useMaintenanceStore: () => maintenanceStoreMock,
}))
vi.mock('@/stores/deviceModels', () => ({
  useDeviceModelsStore: () => deviceModelsStoreMock,
}))
vi.mock('@/stores/firmware', () => ({
  useFirmwareStore: () => firmwareStoreMock,
}))

function mountView() {
  return mount(MaintenanceView, {
    attachTo: document.body,
    global: { plugins: [vuetify] },
  })
}

describe('maintenanceView', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    maintenanceStoreMock = asStore<ReturnType<typeof useMaintenanceStore>>({
      issues: ISSUES,
      loading: false,
      error: null,
      scanSystem: vi.fn().mockResolvedValue(undefined),
      cleanupIssues: vi.fn().mockResolvedValue({ filesDeleted: 1, dirsDeleted: 0, screensDeleted: 0, bytesFreed: 1024, errors: [] }),
      getStats: vi.fn(),
      clearIssues: vi.fn(),
    })
    deviceModelsStoreMock = asStore<ReturnType<typeof useDeviceModelsStore>>({
      models: [],
      activeModels: [],
      palettes: [],
      loaded: true,
      syncing: false,
      error: null,
      fetchAll: vi.fn(),
      ensureLoaded: vi.fn().mockResolvedValue(undefined),
      getByName: vi.fn(),
      palettesFor: vi.fn(() => []),
      sync: vi.fn().mockResolvedValue({ models: 2, palettes: 1, deprecatedModels: 0, deprecatedPalettes: 0, syncedAt: '2026-01-01' }),
    })
    firmwareStoreMock = asStore<ReturnType<typeof useFirmwareStore>>({
      firmware: [],
      activeFirmware: [],
      loaded: true,
      syncing: false,
      uploading: false,
      error: null,
      fetchAll: vi.fn(),
      ensureLoaded: vi.fn().mockResolvedValue(undefined),
      getById: vi.fn(),
      compatibleWith: vi.fn(() => []),
      sync: vi.fn().mockResolvedValue({ inserted: true, version: '1.0.0' }),
      upload: vi.fn().mockResolvedValue(true),
      remove: vi.fn().mockResolvedValue(true),
    })
  })

  it('scans the system, loads device models and firmware on mount', async () => {
    mountView()
    await flushPromises()
    expect(maintenanceStoreMock.scanSystem).toHaveBeenCalled()
    expect(deviceModelsStoreMock.ensureLoaded).toHaveBeenCalled()
    expect(firmwareStoreMock.ensureLoaded).toHaveBeenCalled()
  })

  it('shows the scanned issues in the summary and orphaned files list', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('Scan Summary')
    expect(wrapper.text()).toContain('/orphaned/s1.png')
  })

  it('syncs device models when the sync button on the device models card is clicked', async () => {
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-test-id="sync-device-models-btn"]').trigger('click')
    expect(deviceModelsStoreMock.sync).toHaveBeenCalled()
  })

  it('cleans up the selected issue and re-scans after confirming a non-dry-run cleanup', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('input[type="checkbox"]').setValue(true)
    const dryRunSwitch = wrapper.find('.v-switch input[type="checkbox"]')
    await dryRunSwitch.setValue(false)

    const previewBtn = wrapper.findAll('button').find(b => b.text().includes('Clean Selected'))
    await previewBtn?.trigger('click')
    await flushPromises()

    const confirmBtn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Confirm Delete') as HTMLElement
    confirmBtn.click()
    await flushPromises()

    expect(maintenanceStoreMock.cleanupIssues).toHaveBeenCalledWith(['/orphaned/s1.png'], [], [], [], [], false)
    expect(maintenanceStoreMock.scanSystem).toHaveBeenCalledTimes(2)
  })
})
