<script setup lang="ts">
import type { Device } from '@/types'
import { mdiDelete, mdiEye, mdiOpenInNew, mdiRefresh } from '@mdi/js'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { useScreensStore } from '@/stores/screens'

const props = defineProps<{ device: Device }>()
const device = computed(() => props.device)
const screensStore = useScreensStore()
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
const showHtmlPreview = ref(false)
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
  doc.write(`<html><head><link rel="stylesheet" href="https://usetrmnl.com/css/latest/plugins.css"><script src="https://usetrmnl.com/js/latest/plugins.js"><\/script></head><body>${html}</body></html>`)
  doc.close()
  showHtmlPreview.value = true
}
</script>

<template>
  <v-card elevation="1">
    <v-card-title>Screens</v-card-title>
    <v-divider />
    <v-card-text>
      <v-table v-if="screensStore.screens.length" density="comfortable">
        <thead>
          <tr>
            <th>Type</th>
            <th>Filename</th>
            <th>Status</th>
            <th class="text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="screen in screensStore.screens" :key="screen.id">
            <td>
              <v-chip :color="screen.externalLink ? 'info' : 'primary'" size="small">
                {{ screen.externalLink ? screen.fetchManual ? 'External (cached)' : 'External' : screen.html ? 'HTML' : 'File' }}
              </v-chip>
            </td>
            <td>
              <span>{{ screen.filename }}</span>
            </td>
            <td>
              <v-chip v-if="screen.isActive" color="success" size="small">
                Active
              </v-chip>
              <v-chip v-else color="grey" size="small">
                Queued
              </v-chip>
            </td>
            <td class="text-right">
              <v-btn
                v-if="screen.externalLink && screen.fetchManual"
                color="warning"
                size="small"
                variant="tonal"
                class="mr-2"
                :icon="mdiRefresh"
                @click="updateExternalImage(screen.id)"
              />
              <v-btn
                v-if="screen.externalLink"
                size="small" class="mr-2" :href="screen.externalLink" target="_blank" variant="tonal" color="secondary" :icon="mdiOpenInNew"
              />
              <v-btn
                v-else-if="screen.html"
                size="small" class="mr-2" :icon="mdiEye" variant="tonal" color="secondary" @click="renderPreviewHtml(screen.html)"
              />
              <v-btn
                v-else
                size="small" class="mr-2" :href="`/screens/devices/${device?.id}/${screen.id}.bmp`" target="_blank" variant="tonal" color="secondary" :icon="mdiOpenInNew"
              />
              <v-btn
                size="small"

                color="error"
                variant="tonal"
                :icon="mdiDelete"
                @click="deleteScreen(screen.id)"
              />
            </td>
          </tr>
        </tbody>
      </v-table>
      <v-alert v-else type="info">
        No screens for this device. Add one.
      </v-alert>
    </v-card-text>
  </v-card>
  <v-overlay v-model="showHtmlPreview" class="align-center justify-center">
    <iframe ref="previewIframeRef" :width="(device.width || 0) + 5" :height="(device.height || 0) + 5" class="align-center" />
  </v-overlay>
</template>
