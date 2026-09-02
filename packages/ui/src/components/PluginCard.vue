<script setup lang="ts">
import type { Plugin } from '../types/plugin'
import { mdiAccountMultiple } from '@mdi/js'
import { computed } from 'vue'
import { VCard, VCardText, VCardTitle, VChip, VDivider } from 'vuetify/components'
import PluginCardActions from './PluginCardActions.vue'

const props = defineProps<{
  plugin: Plugin
  deviceId?: string
}>()

const emit = defineEmits<{
  assignmentsChanged: []
  deleted: []
}>()

const assignedCount = computed(() => props.plugin.deviceAssignments?.length || 0)
</script>

<template>
  <VCard elevation="1" class="h-100">
    <VCardTitle class="d-flex align-center justify-space-between flex-wrap ga-2">
      <span>{{ plugin.name }}</span>
      <div class="d-flex ga-2">
        <VChip
          v-if="!deviceId && assignedCount > 0"
          :prepend-icon="mdiAccountMultiple"
          size="small"
          variant="tonal"
        >
          {{ assignedCount }} device{{ assignedCount !== 1 ? 's' : '' }}
        </VChip>
        <VChip
          v-if="deviceId"
          :color="plugin._isActive ? 'success' : 'default'"
          size="small"
          variant="tonal"
        >
          {{ plugin._isActive ? 'Active' : 'Inactive' }}
        </VChip>
      </div>
    </VCardTitle>
    <VDivider />
    <VCardText>
      <div v-if="plugin.description" class="text-body-2 text-medium-emphasis">
        {{ plugin.description }}
      </div>
      <div v-else class="text-body-2 text-disabled">
        No description
      </div>
    </VCardText>
    <PluginCardActions
      :plugin="plugin"
      :device-id="deviceId"
      @assignments-changed="emit('assignmentsChanged')"
      @deleted="emit('deleted')"
    />
  </VCard>
</template>
