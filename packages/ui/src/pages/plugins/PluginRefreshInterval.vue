<script setup lang="ts">
import type { DataSourcesDraft } from './pluginDataSources'
import NumberInput from '@/components/NumberInput.vue'
import Select from '@/components/Select.vue'
import SettingRow from '@/components/SettingRow.vue'
import { RATE_UNIT_OPTIONS } from '@/pages/devices/deviceSettings'
import { fieldId } from './pluginPage'

defineProps<{
  pluginName: string
  error?: string
}>()

const interval = defineModel<DataSourcesDraft['interval']>('interval', { required: true })
</script>

<template>
  <SettingRow :id="fieldId('refreshInterval')" label="Fetch" :error="error">
    <template #default="{ control }">
      every
      <NumberInput v-model="interval.amount" v-bind="control" class="amount" inputmode="numeric" min="1" />
      <Select
        class="unit"
        aria-label="Refresh interval unit"
        :model-value="interval.unit"
        :options="RATE_UNIT_OPTIONS"
        @update:model-value="unit => interval.unit = unit ?? 'minutes'"
      />
    </template>
    <template #note>
      The refresh interval: how often Kuroshiro fetches every Data Source and renders {{ pluginName }} again. A Device shows the newest render at its own next poll.
    </template>
  </SettingRow>
</template>

<style scoped>
@layer components {
  :deep(.amount) {
    width: 4.5rem;
  }

  :deep(.unit) {
    min-width: 7rem;
  }
}
</style>
