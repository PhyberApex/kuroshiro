<script setup lang="ts">
import type { DeviceDetail, RotationMode } from 'kuroshiro-shared'
import Select from '@/components/Select.vue'
import SettingRow from '@/components/SettingRow.vue'
import { useDeviceSetting } from './useDeviceSetting'

const props = defineProps<{
  device: DeviceDetail
}>()

const OPTIONS: { value: RotationMode, label: string }[] = [
  { value: 'automatic', label: 'Every poll' },
  { value: 'manual', label: 'On button press' },
]

const mode = useDeviceSetting<RotationMode>(() => props.device.rotationMode, chosen =>
  chosen === props.device.rotationMode ? undefined : { rotationMode: chosen })
</script>

<template>
  <SettingRow label="Advance" :status="mode.status" :reason="mode.reason" @retry="mode.retry">
    <template #default="{ control }">
      <Select
        v-bind="control"
        :model-value="mode.entered"
        :options="OPTIONS"
        :disabled="device.isMirrored"
        @update:model-value="mode.choose($event ?? 'automatic')"
      />
    </template>
    <template #note>
      <template v-if="device.isMirrored">
        Not applied while {{ device.name }} is Mirroring.
      </template>
      <template v-else>
        On button press, {{ device.name }} keeps its Current Screen, redrawn fresh at every poll, until its button is pressed or you choose a Screen to show next.
      </template>
    </template>
  </SettingRow>
</template>
