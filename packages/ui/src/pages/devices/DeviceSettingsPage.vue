<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import type { SettingsReference } from './deviceSettings'
import { listDeviceModels, listPalettes } from '@/api/device-models'
import { listFirmware } from '@/api/firmware'
import { getInstanceSettings } from '@/api/instance'
import { joinLoads } from '@/patterns/joinLoads'
import LoadBody from '@/patterns/LoadBody.vue'
import { useLoad } from '@/patterns/useLoad'
import { useDeviceFrame } from './deviceFrame'
import { possessive } from './screenNaming'
import SettingsDisplay from './SettingsDisplay.vue'
import SettingsFirmware from './SettingsFirmware.vue'
import SettingsIdentity from './SettingsIdentity.vue'
import SettingsLoading from './SettingsLoading.vue'
import SettingsMirroring from './SettingsMirroring.vue'
import SettingsResetOrDelete from './SettingsResetOrDelete.vue'
import SettingsSleepMode from './SettingsSleepMode.vue'
import SettingsSpecialFunctions from './SettingsSpecialFunctions.vue'

const { device, name } = useDeviceFrame()

/** What the selects offer and what the Firmware section says: none of it changes with the Device, so it is read once. */
const reference = useLoad<SettingsReference>(async () => {
  const [{ models }, palettes, { firmware }, settings] = await Promise.all([listDeviceModels(), listPalettes(), listFirmware(), getInstanceSettings()])
  return { models, palettes, firmware, firmwareAutoUpdate: settings.firmwareAutoUpdate.value }
})

const page = joinLoads<{ device: DeviceDetail, reference: SettingsReference }>({ device, reference })
</script>

<template>
  <div class="device-settings">
    <LoadBody :load="page" :loading="`Loading ${possessive(name)} Settings`" :failed="`Could not load ${possessive(name)} Settings.`">
      <template #skeleton>
        <SettingsLoading />
      </template>
      <template #default="{ data }">
        <p class="lede">
          Changes save as you make them.
        </p>
        <SettingsDisplay class="first" :device="data.device" :reference="data.reference" />
        <SettingsSleepMode :device="data.device" />
        <SettingsFirmware :device="data.device" :reference="data.reference" />
        <SettingsMirroring :device="data.device" />
        <div class="tucked">
          <SettingsIdentity :device="data.device" />
          <SettingsSpecialFunctions :device="data.device" />
          <SettingsResetOrDelete :device="data.device" />
        </div>
      </template>
    </LoadBody>
  </div>
</template>

<style scoped>
@layer components {
  .device-settings {
    margin-top: var(--space-8);
  }

  .lede {
    color: var(--color-ink-soft);
  }

  .first {
    margin-top: var(--space-8);
  }

  .tucked {
    margin-top: var(--space-12);
  }

  @media (max-width: 820px) {
    .device-settings,
    .first {
      margin-top: var(--space-6);
    }
  }
}
</style>
