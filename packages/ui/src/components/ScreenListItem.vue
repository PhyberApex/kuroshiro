<script setup lang="ts">
import type { Screen } from '@/types'
import { mdiCalendarClock, mdiChevronDown, mdiChevronUp, mdiDelete, mdiDrag, mdiEye, mdiOpenInNew, mdiRefresh } from '@mdi/js'
import { computed } from 'vue'
import { VBtn, VChip, VIcon, VTooltip } from 'vuetify/components'
import { screenScheduleColor, screenScheduleLabel } from '@/utils/schedule'

const props = defineProps<{
  screen: Screen
  canMoveUp: boolean
  canMoveDown: boolean
  isReordering: boolean
  isDragOver: boolean
}>()

defineEmits<{
  dragstart: []
  dragover: []
  drop: []
  dragend: []
  moveUp: []
  moveDown: []
  editSchedule: []
  updateExternalImage: []
  previewHtml: []
  previewScreen: []
  delete: []
}>()

const typeColor = computed(() => {
  const { screen } = props
  if (screen.type === 'mashup')
    return 'orange'
  if (screen.plugin)
    return 'purple'
  if (screen.externalLink)
    return 'info'
  return 'primary'
})

const typeLabel = computed(() => {
  const { screen } = props
  if (screen.type === 'mashup')
    return 'Mashup'
  if (screen.plugin)
    return 'Plugin'
  if (screen.externalLink)
    return screen.fetchManual ? 'External (cached)' : 'External'
  return screen.html ? 'HTML' : 'File'
})

const previewAriaLabel = computed(() => {
  const { screen } = props
  if (screen.type === 'mashup')
    return 'Preview mashup'
  return screen.plugin ? 'Preview plugin output' : 'Preview screen'
})
</script>

<template>
  <tr
    :draggable="!isReordering"
    :class="{ 'bg-grey-lighten-3': isDragOver }"
    :data-test-id="`screen-row-${screen.id}`"
    @dragstart="$emit('dragstart')"
    @dragover.prevent="$emit('dragover')"
    @drop="$emit('drop')"
    @dragend="$emit('dragend')"
  >
    <td>
      <div class="d-flex align-center">
        <VIcon :icon="mdiDrag" class="mr-1 cursor-grab" aria-hidden="true" />
        <div class="d-flex flex-column">
          <VBtn
            size="x-small"
            variant="text"
            density="compact"
            :icon="mdiChevronUp"
            :disabled="isReordering || !canMoveUp"
            aria-label="Move screen up"
            :data-test-id="`screen-move-up-${screen.id}`"
            @click="$emit('moveUp')"
          />
          <VBtn
            size="x-small"
            variant="text"
            density="compact"
            :icon="mdiChevronDown"
            :disabled="isReordering || !canMoveDown"
            aria-label="Move screen down"
            :data-test-id="`screen-move-down-${screen.id}`"
            @click="$emit('moveDown')"
          />
        </div>
      </div>
    </td>
    <td>
      <VChip :color="typeColor" size="small">
        {{ typeLabel }}
      </VChip>
    </td>
    <td>
      <span>{{ screen.plugin ? screen.plugin.name : screen.filename }}</span>
    </td>
    <td>
      <VBtn
        size="small"
        variant="tonal"
        :color="screenScheduleColor(screen)"
        :prepend-icon="mdiCalendarClock"
        :aria-label="`Edit schedule for ${screen.filename ?? screen.id}`"
        :data-test-id="`screen-schedule-btn-${screen.id}`"
        @click="$emit('editSchedule')"
      >
        {{ screenScheduleLabel(screen) }}
      </VBtn>
    </td>
    <td>
      <VChip v-if="screen.isActive" color="success" size="small">
        Active
      </VChip>
      <VChip v-else color="secondary" size="small">
        Queued
      </VChip>
    </td>
    <td class="text-right">
      <VBtn
        v-if="!screen.plugin && screen.externalLink && screen.fetchManual"
        color="warning"
        size="small"
        variant="tonal"
        class="mr-2"
        :icon="mdiRefresh"
        aria-label="Update cached image"
        @click="$emit('updateExternalImage')"
      />
      <VBtn
        v-if="!screen.plugin && screen.externalLink"
        size="small"
        class="mr-2"
        :href="screen.externalLink"
        target="_blank"
        variant="tonal"
        color="secondary"
        :icon="mdiOpenInNew"
        aria-label="Open link in new tab"
      />
      <VBtn
        v-else-if="!screen.plugin && screen.html"
        size="small"
        class="mr-2"
        :icon="mdiEye"
        variant="tonal"
        color="secondary"
        aria-label="Preview HTML"
        @click="$emit('previewHtml')"
      />
      <VBtn
        v-else
        size="small"
        class="mr-2"
        :icon="mdiEye"
        variant="tonal"
        color="secondary"
        :aria-label="previewAriaLabel"
        @click="$emit('previewScreen')"
      />
      <VBtn
        v-if="!screen.plugin"
        size="small"
        color="error"
        variant="tonal"
        :icon="mdiDelete"
        aria-label="Delete screen"
        :data-test-id="`screen-delete-btn-${screen.id}`"
        @click="$emit('delete')"
      />
      <VTooltip v-else text="Unassign plugin from Manage Plugins page">
        <template #activator="{ props: tooltipProps }">
          <VBtn
            size="small"
            color="secondary"
            variant="tonal"
            :icon="mdiDelete"
            disabled
            v-bind="tooltipProps"
          />
        </template>
      </VTooltip>
    </td>
  </tr>
</template>
