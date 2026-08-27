<script setup lang="ts">
import type { Screen } from '@/types'
import { VTable } from 'vuetify/components'
import ScreenListItem from '@/components/ScreenListItem.vue'

const props = defineProps<{
  screens: Screen[]
  isReordering: boolean
  draggingIndex: number | null
  dragOverIndex: number | null
}>()

defineEmits<{
  dragstart: [index: number]
  dragover: [index: number]
  drop: [index: number]
  dragend: []
  moveUp: [index: number]
  moveDown: [index: number]
  editSchedule: [screen: Screen]
  updateExternalImage: [screenId: string]
  previewHtml: [html: string | null | undefined]
  previewScreen: [screen: Screen]
  delete: [screenId: string]
}>()

function isDragOver(index: number) {
  return props.dragOverIndex === index && props.draggingIndex !== null && props.draggingIndex !== index
}
</script>

<template>
  <div class="overflow-x-auto">
    <VTable density="comfortable" data-test-id="screen-table">
      <thead>
        <tr>
          <th>Order</th>
          <th>Type</th>
          <th>Filename</th>
          <th>Schedule</th>
          <th>Status</th>
          <th class="text-right">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        <ScreenListItem
          v-for="(screen, index) in screens"
          :key="screen.id"
          :screen="screen"
          :can-move-up="index > 0"
          :can-move-down="index < screens.length - 1"
          :is-reordering="isReordering"
          :is-drag-over="isDragOver(index)"
          @dragstart="$emit('dragstart', index)"
          @dragover="$emit('dragover', index)"
          @drop="$emit('drop', index)"
          @dragend="$emit('dragend')"
          @move-up="$emit('moveUp', index)"
          @move-down="$emit('moveDown', index)"
          @edit-schedule="$emit('editSchedule', screen)"
          @update-external-image="$emit('updateExternalImage', screen.id)"
          @preview-html="$emit('previewHtml', screen.html)"
          @preview-screen="$emit('previewScreen', screen)"
          @delete="$emit('delete', screen.id)"
        />
      </tbody>
    </VTable>
  </div>
</template>
