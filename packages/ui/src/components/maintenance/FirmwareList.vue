<script setup lang="ts">
import type { Firmware } from '@/types'
import { mdiDelete } from '@mdi/js'
import { VBtn, VChip, VList, VListItem, VListItemSubtitle, VListItemTitle } from 'vuetify/components'

defineProps<{
  firmware: Firmware[]
}>()

defineEmits<{
  delete: [id: string]
}>()
</script>

<template>
  <VList v-if="firmware.length > 0" density="compact" class="mb-4">
    <VListItem v-for="fw in firmware" :key="fw.id" :data-test-id="`firmware-row-${fw.id}`">
      <VListItemTitle class="text-body-2">
        {{ fw.version }}
        <VChip size="x-small" class="ml-2">
          {{ fw.kind === 'official-synced' ? 'official' : 'custom' }}
        </VChip>
        <VChip v-if="fw.label" size="x-small" variant="tonal" class="ml-1">
          {{ fw.label }}
        </VChip>
      </VListItemTitle>
      <VListItemSubtitle class="text-caption">
        {{ fw.compatibleModels.length > 0 ? fw.compatibleModels.join(', ') : 'Universal (all models)' }}
      </VListItemSubtitle>
      <template v-if="fw.kind === 'custom'" #append>
        <VBtn
          :icon="mdiDelete"
          size="small"
          variant="text"
          color="error"
          :data-test-id="`firmware-delete-${fw.id}`"
          @click="$emit('delete', fw.id)"
        />
      </template>
    </VListItem>
  </VList>
</template>
