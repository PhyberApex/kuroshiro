<script setup lang="ts">
import type { AdditionalInfoMap } from '@/types.ts'
import { VCol, VRow } from 'vuetify/components'

defineProps<{ info: AdditionalInfoMap }>()

function formatValue(value: AdditionalInfoMap[string]) {
  return value || '—'
}
</script>

<template>
  <div>
    <div class="text-subtitle-2 mb-2 font-weight-bold">
      Additional Info
    </div>
    <VRow dense>
      <VCol
        v-for="(value, key) in info"
        :key="key"
        cols="12"
        sm="6"
      >
        <div class="text-caption text-medium-emphasis">
          {{ key }}
        </div>
        <div class="text-body-2">
          {{ formatValue(value) }}
        </div>
      </VCol>
    </VRow>
  </div>
</template>
