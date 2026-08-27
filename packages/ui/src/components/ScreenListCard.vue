<script setup lang="ts">
import type { Screen } from '@/types'
import { ref } from 'vue'
import { VAlert, VCard, VCardText, VCardTitle, VChip, VDivider, VOverlay } from 'vuetify/components'
import ScreenFrame from '@/components/ScreenFrame.vue'
import ScreenPreviewDialog from '@/components/ScreenPreviewDialog.vue'
import ScreenScheduleDialog from '@/components/ScreenScheduleDialog.vue'
import ScreenTable from '@/components/ScreenTable.vue'
import { useDeviceRenderContext } from '@/composeables/useDeviceRenderContext'
import { viewFull } from '@/utils/screenShell'

const props = defineProps<{ deviceId: string }>()

const { device, renderTarget, screensStore } = useDeviceRenderContext(() => props.deviceId)
async function deleteScreen(screenId: string) {
  if (!device.value)
    return
  await screensStore.deleteScreen(device.value.id, screenId)
}
async function updateExternalImage(screenId: string) {
  if (!device.value)
    return
  await screensStore.updateExternalScreen(device.value.id, screenId)
}

const isReordering = ref(false)
const reorderError = ref<string | null>(null)
const draggingIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

async function persistOrder(orderedIds: string[]) {
  if (!device.value)
    return
  isReordering.value = true
  reorderError.value = null
  try {
    await screensStore.reorderScreens(device.value.id, orderedIds)
  }
  catch {
    reorderError.value = 'Failed to save the new screen order. The list has been reloaded.'
  }
  finally {
    isReordering.value = false
  }
}

function onDragStart(index: number) {
  draggingIndex.value = index
}

function onDragEnter(index: number) {
  dragOverIndex.value = index
}

function onDragEnd() {
  draggingIndex.value = null
  dragOverIndex.value = null
}

function currentScreenIds() {
  return screensStore.screens.map(screen => screen.id)
}

function onDrop(targetIndex: number) {
  const sourceIndex = draggingIndex.value
  draggingIndex.value = null
  dragOverIndex.value = null
  if (sourceIndex === null || sourceIndex === targetIndex)
    return
  const orderedIds = currentScreenIds()
  const [movedId] = orderedIds.splice(sourceIndex, 1)
  orderedIds.splice(targetIndex, 0, movedId)
  persistOrder(orderedIds)
}

function moveScreen(index: number, direction: -1 | 1) {
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= screensStore.screens.length)
    return
  const orderedIds = currentScreenIds()
  ;[orderedIds[index], orderedIds[targetIndex]] = [orderedIds[targetIndex], orderedIds[index]]
  persistOrder(orderedIds)
}
const showScheduleDialog = ref(false)
const scheduleScreen = ref<Screen | null>(null)

function editSchedule(screen: Screen) {
  scheduleScreen.value = screen
  showScheduleDialog.value = true
}

const showHtmlPreview = ref(false)
const showScreenPreview = ref(false)
const selectedPreviewScreen = ref<Screen | null>(null)
const previewMode = ref<'html' | 'image' | 'plugin' | 'mashup'>('image')

const overlayHtml = ref('')
function renderPreviewHtml(html: string | null | undefined) {
  overlayHtml.value = html ?? ''
  showHtmlPreview.value = true
}

function previewScreen(screen: Screen) {
  if (!device.value)
    return
  selectedPreviewScreen.value = screen

  if (screen.type === 'mashup') {
    previewMode.value = 'mashup'
  }
  else if (screen.html) {
    previewMode.value = 'html'
  }
  else if (screen.plugin) {
    previewMode.value = 'plugin'
  }
  else {
    previewMode.value = 'image'
  }

  showScreenPreview.value = true
}

defineExpose({
  showScreenPreview,
  previewMode,
  selectedPreviewScreen,
})
</script>

<template>
  <template v-if="device">
    <VCard elevation="1" class="mb-6">
      <VCardTitle class="d-flex align-center">
        Screens
        <VChip v-if="isReordering" size="small" color="info" variant="tonal" class="ml-3" data-test-id="reorder-saving-indicator">
          Saving order…
        </VChip>
      </VCardTitle>
      <VDivider />
      <VCardText>
        <VAlert
          v-if="reorderError"
          type="error"
          variant="tonal"
          class="mb-4"
          closable
          data-test-id="reorder-error-alert"
          @click:close="reorderError = null"
        >
          {{ reorderError }}
        </VAlert>
        <ScreenTable
          v-if="screensStore.screens.length"
          :screens="screensStore.screens"
          :is-reordering="isReordering"
          :dragging-index="draggingIndex"
          :drag-over-index="dragOverIndex"
          @dragstart="onDragStart"
          @dragover="onDragEnter"
          @drop="onDrop"
          @dragend="onDragEnd"
          @move-up="index => moveScreen(index, -1)"
          @move-down="index => moveScreen(index, 1)"
          @edit-schedule="editSchedule"
          @update-external-image="updateExternalImage"
          @preview-html="renderPreviewHtml"
          @preview-screen="previewScreen"
          @delete="deleteScreen"
        />
        <VAlert v-else type="info" variant="tonal" class="text-body-2" data-test-id="screen-empty-alert">
          No screens yet. Add one in Add Screen above.
        </VAlert>
      </VCardText>
    </VCard>
    <ScreenScheduleDialog
      v-if="scheduleScreen"
      v-model="showScheduleDialog"
      :device-id="device.id"
      :screen="scheduleScreen"
    />

    <VOverlay v-model="showHtmlPreview" class="align-center justify-center">
      <ScreenFrame v-if="showHtmlPreview" :body="viewFull(overlayHtml)" :target="renderTarget" />
    </VOverlay>

    <ScreenPreviewDialog
      v-model="showScreenPreview"
      :screen="selectedPreviewScreen"
      :mode="previewMode"
      :render-target="renderTarget"
      :device-id="device.id"
    />
  </template>
</template>
