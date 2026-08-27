import type { Firmware } from '@/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import vuetify from '@/plugins/vuetify'
import FirmwareCard from '../FirmwareCard.vue'

const OFFICIAL: Firmware = { id: 'fw-1', version: '1.5.6', kind: 'official-synced', checksum: 'x', compatibleModels: [], deprecated: false }
const CUSTOM: Firmware = { id: 'fw-2', version: '1.0.0', kind: 'custom', checksum: 'y', compatibleModels: ['v2'], label: 'Beta', deprecated: false }

function mountCard(props: Partial<InstanceType<typeof FirmwareCard>['$props']> = {}) {
  return mount(FirmwareCard, {
    props: {
      activeFirmware: [OFFICIAL, CUSTOM],
      totalFirmwareCount: 2,
      lastSyncedAt: null,
      syncing: false,
      uploading: false,
      error: null,
      syncResult: null,
      deviceModelOptions: [{ title: 'TRMNL X', value: 'v2' }],
      ...props,
    },
    global: { plugins: [vuetify] },
  })
}

describe('firmwareCard', () => {
  it('lists active firmware via FirmwareList', () => {
    const wrapper = mountCard()
    expect(wrapper.find('[data-test-id="firmware-row-fw-1"]').text()).toContain('1.5.6')
    expect(wrapper.find('[data-test-id="firmware-row-fw-2"]').text()).toContain('Beta')
  })

  it('emits delete with the firmware id', async () => {
    const wrapper = mountCard()
    await wrapper.find('[data-test-id="firmware-delete-fw-2"]').trigger('click')
    expect(wrapper.emitted('delete')).toEqual([['fw-2']])
  })

  it('emits sync when the sync button is clicked', async () => {
    const wrapper = mountCard()
    await wrapper.find('[data-test-id="sync-firmware-btn"]').trigger('click')
    expect(wrapper.emitted('sync')).toHaveLength(1)
  })

  it('disables upload until a version and file are provided', async () => {
    const wrapper = mountCard()
    const uploadBtn = wrapper.find('[data-test-id="firmware-upload-btn"]')
    expect(uploadBtn.attributes('disabled')).toBeDefined()

    await wrapper.find('[data-test-id="firmware-upload-version"] input').setValue('2.0.0')
    expect(wrapper.find('[data-test-id="firmware-upload-btn"]').attributes('disabled')).toBeDefined()
  })

  it('emits upload with the form contents and resets after resetUploadForm is called', async () => {
    const wrapper = mountCard()
    await wrapper.find('[data-test-id="firmware-upload-version"] input').setValue('2.0.0')
    ;(wrapper.vm as unknown as { uploadFile: File[] }).uploadFile = [new File(['x'], 'fw.bin')]
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-test-id="firmware-upload-btn"]').trigger('click')
    expect(wrapper.emitted('upload')?.[0]?.[0]).toMatchObject({ version: '2.0.0' })

    wrapper.vm.resetUploadForm()
    await wrapper.vm.$nextTick()
    expect((wrapper.find('[data-test-id="firmware-upload-version"] input').element as HTMLInputElement).value).toBe('')
  })
})
