<script setup lang="ts">
import type { DeviceModelRead } from 'kuroshiro-shared'
import type { DevicePreviewState } from './useDevicePreview'
import { computed } from 'vue'
import Notice from '@/components/Notice.vue'
import PreviewPlate from '@/components/PreviewPlate.vue'
import { devicePreviewDrawingLine } from './pluginTemplateWording'

/** The plate of the Template section, or why there is none: what it is drawn with could not be loaded, or the Instance holds nothing to draw it for. */
const props = defineProps<{
  pluginName: string
  /** Why the Liquid engine or the Device Models could not be loaded, as a sentence. */
  loadFailure: string | undefined
  /** The Device Models are there, and none of them has a Palette to draw for. */
  nothingToDrawFor: boolean
  /** The Device Model the preview is for, once it is known. */
  model: Pick<DeviceModelRead, 'width' | 'height'> | undefined
  document: string | null
  notDrawn: boolean
  /** What the plate has no drawing for yet. It is in its rendering state while this or the Device Model is missing. */
  waitingFor: string | undefined
  hasData: boolean
  /** The device preview's own drawing (ADR-0040), which replaces the live browser drawing once it lands. */
  devicePreview: DevicePreviewState
  /** The Device the device preview is for, by name only, for "Drawing it as {Device} shows it". */
  deviceName: string | null
}>()

defineEmits<{
  retry: []
}>()

/** The device preview's own PNG once it is drawn; the live browser drawing at every other time, kept while it draws, is busy or has failed. */
const shownDocument = computed(() => props.devicePreview.status === 'drawn' ? props.devicePreview.document : props.document)
const drawingNote = computed(() => props.devicePreview.status === 'drawing' ? devicePreviewDrawingLine(props.deviceName) : undefined)
</script>

<template>
  <Notice v-if="loadFailure" title="Could not load the preview." :reason="loadFailure" action="Try again" @act="$emit('retry')" />
  <p v-else-if="nothingToDrawFor" class="none">
    No preview: this Instance holds no Device Model with a Palette to draw it for.
  </p>
  <PreviewPlate
    v-else
    :name="devicePreview.status === 'drawn' ? `Preview of ${pluginName} as ${deviceName ?? 'the Device'} shows it` : `Preview of ${pluginName}`"
    :document="shownDocument"
    :width="model?.width ?? 800"
    :height="model?.height ?? 480"
    :not-drawn="devicePreview.status === 'drawn' ? false : notDrawn"
    :rendering="!model || !hasData"
    :rendering-note="waitingFor"
    :drawing-note="drawingNote"
  />
</template>

<style scoped>
@layer components {
  .none {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
