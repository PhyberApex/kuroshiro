<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import type { SettingsReference } from './deviceSettings'
import { computed } from 'vue'
import Select from '@/components/Select.vue'
import SettingRow from '@/components/SettingRow.vue'
import { paletteOptions } from './deviceSettings'
import { useDeviceSetting } from './useDeviceSetting'

const props = defineProps<{
  device: DeviceDetail
  reference: SettingsReference
}>()

const palette = useDeviceSetting(() => props.device.palette?.id ?? null, chosen =>
  chosen && chosen !== props.device.palette?.id ? { paletteId: chosen } : undefined)

const options = computed(() => paletteOptions(
  props.reference.models.find(model => model.name === props.device.deviceModel?.name),
  props.reference.palettes,
  props.device.palette,
))
</script>

<template>
  <SettingRow label="Palette" :status="palette.status" :reason="palette.reason" @retry="palette.retry">
    <template #default="{ control }">
      <Select
        v-bind="control"
        :model-value="palette.entered"
        :options="options"
        :disabled="options.length === 0"
        placeholder="None yet"
        @update:model-value="palette.choose"
      />
    </template>
    <template #note>
      Changing the Device Model or the Palette converts this Device's stored images again.
    </template>
  </SettingRow>
</template>
