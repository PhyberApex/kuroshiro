<script setup lang="ts">
import type { Screen } from '@/types'
import { mdiChevronDown, mdiChevronUp, mdiDelete, mdiDrag, mdiEye, mdiOpenInNew, mdiRefresh } from '@mdi/js'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { VAlert, VBtn, VCard, VCardActions, VCardText, VCardTitle, VChip, VDialog, VDivider, VIcon, VOverlay, VSpacer, VTable, VTooltip } from 'vuetify/components'
import { useDeviceStore } from '@/stores/device.ts'
import { useScreensStore } from '@/stores/screens'

const props = defineProps<{ deviceId: string }>()

const screensStore = useScreensStore()
const deviceStore = useDeviceStore()
const device = computed(() => deviceStore.getById(props.deviceId))
const previewIframeRef = useTemplateRef('previewIframeRef')
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
const showHtmlPreview = ref(false)
const showScreenPreview = ref(false)
const selectedPreviewScreen = ref<Screen | null>(null)
const previewMode = ref<'html' | 'image' | 'plugin' | 'mashup'>('image')

async function renderPreviewHtml(html: string) {
  showHtmlPreview.value = true
  await nextTick()
  const iframe = previewIframeRef.value
  if (!iframe)
    return

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc)
    return
  doc.open()
  doc.write(`<html><head><link rel="stylesheet" href="https://usetrmnl.com/css/latest/plugins.css"><script src="https://usetrmnl.com/js/latest/plugins.js"><\/script></head><body class="environment trmnl"><div class="screen"><div class="view view--full">${html}</div></div></body></html>`)
  doc.close()
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
        <template v-if="screensStore.screens.length">
          <div class="overflow-x-auto">
            <VTable density="comfortable" data-test-id="screen-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Type</th>
                  <th>Filename</th>
                  <th>Status</th>
                  <th class="text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(screen, index) in screensStore.screens"
                  :key="screen.id"
                  :draggable="!isReordering"
                  :class="{ 'bg-grey-lighten-3': dragOverIndex === index && draggingIndex !== null && draggingIndex !== index }"
                  :data-test-id="`screen-row-${screen.id}`"
                  @dragstart="onDragStart(index)"
                  @dragover.prevent="onDragEnter(index)"
                  @drop="onDrop(index)"
                  @dragend="onDragEnd"
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
                          :disabled="isReordering || index === 0"
                          aria-label="Move screen up"
                          :data-test-id="`screen-move-up-${screen.id}`"
                          @click="moveScreen(index, -1)"
                        />
                        <VBtn
                          size="x-small"
                          variant="text"
                          density="compact"
                          :icon="mdiChevronDown"
                          :disabled="isReordering || index === screensStore.screens.length - 1"
                          aria-label="Move screen down"
                          :data-test-id="`screen-move-down-${screen.id}`"
                          @click="moveScreen(index, 1)"
                        />
                      </div>
                    </div>
                  </td>
                  <td>
                    <VChip
                      :color="screen.type === 'mashup' ? 'orange' : screen.plugin ? 'purple' : screen.externalLink ? 'info' : 'primary'"
                      size="small"
                    >
                      {{ screen.type === 'mashup' ? 'Mashup' : screen.plugin ? 'Plugin' : screen.externalLink ? screen.fetchManual ? 'External (cached)' : 'External' : screen.html ? 'HTML' : 'File' }}
                    </VChip>
                  </td>
                  <td>
                    <span>{{ screen.plugin ? screen.plugin.name : screen.filename }}</span>
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
                      @click="updateExternalImage(screen.id)"
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
                      @click="renderPreviewHtml(screen.html)"
                    />
                    <VBtn
                      v-else
                      size="small"
                      class="mr-2"
                      :icon="mdiEye"
                      variant="tonal"
                      color="secondary"
                      :aria-label="screen.type === 'mashup' ? 'Preview mashup' : screen.plugin ? 'Preview plugin output' : 'Preview screen'"
                      @click="previewScreen(screen)"
                    />
                    <VBtn
                      v-if="!screen.plugin"
                      size="small"
                      color="error"
                      variant="tonal"
                      :icon="mdiDelete"
                      aria-label="Delete screen"
                      :data-test-id="`screen-delete-btn-${screen.id}`"
                      @click="deleteScreen(screen.id)"
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
              </tbody>
            </VTable>
          </div>
        </template>
        <VAlert v-else type="info" variant="tonal" class="text-body-2" data-test-id="screen-empty-alert">
          No screens yet. Add one in Add Screen above.
        </VAlert>
      </VCardText>
    </VCard>
    <VOverlay v-model="showHtmlPreview" class="align-center justify-center">
      <iframe ref="previewIframeRef" :width="(device.width || 0) + 5" :height="(device.height || 0) + 5" class="align-center" />
    </VOverlay>

    <VDialog v-model="showScreenPreview" max-width="900px">
      <VCard v-if="selectedPreviewScreen">
        <VCardTitle>
          {{ selectedPreviewScreen.plugin ? `Plugin: ${selectedPreviewScreen.plugin.name}` : selectedPreviewScreen.filename || 'Screen Preview' }}
        </VCardTitle>
        <VDivider />
        <VCardText class="d-flex flex-column align-center pa-4">
          <!-- Mashup screens: show cached HTML if available, else show message -->
          <div v-if="previewMode === 'mashup'">
            <div v-if="selectedPreviewScreen.cachedPluginOutput" class="mb-4">
              <iframe
                :srcdoc="selectedPreviewScreen.cachedPluginOutput"
                width="800"
                height="480"
                style="border: 1px solid #ccc;"
              />
            </div>
            <VAlert v-else type="info" variant="tonal">
              Mashup output will be generated when a device requests it or when the scheduler runs.
            </VAlert>
          </div>

          <!-- Plugin screens: show cached HTML if available, else show message -->
          <div v-else-if="previewMode === 'plugin'">
            <div v-if="selectedPreviewScreen.cachedPluginOutput" class="mb-4">
              <iframe
                :srcdoc="selectedPreviewScreen.cachedPluginOutput"
                width="800"
                height="480"
                style="border: 1px solid #ccc;"
              />
            </div>
            <VAlert v-else type="info" variant="tonal">
              Plugin output will be generated when a device requests it or when the scheduler runs.
            </VAlert>
          </div>

          <!-- HTML screens -->
          <div v-else-if="previewMode === 'html' && selectedPreviewScreen.html">
            <iframe
              :srcdoc="`<html><head><link rel='stylesheet' href='https://usetrmnl.com/css/latest/plugins.css'><script src='https://usetrmnl.com/js/latest/plugins.js'></script></head><body class='environment trmnl'><div class='screen'><div class='view view--full'>${selectedPreviewScreen.html}</div></div></body></html>`"
              width="800"
              height="480"
              style="border: 1px solid #ccc;"
            />
          </div>

          <!-- Image screens -->
          <div v-else>
            <img
              :src="`/screens/devices/${device?.id}/${selectedPreviewScreen.id}.png`"
              style="max-width: 100%; height: auto; border: 1px solid #ccc;"
              alt="Screen preview"
              @error="($event.target as HTMLImageElement).src = '/screens/error.png'"
            >
          </div>
        </VCardText>
        <VDivider />
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="showScreenPreview = false">
            Close
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </template>
</template>
