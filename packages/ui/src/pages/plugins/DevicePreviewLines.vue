<script setup lang="ts">
import type { TemplateSize } from 'kuroshiro-shared'
import type { WordedTarget } from './pluginTemplateWording'
import type { DevicePreviewState } from './useDevicePreview'
import { computed } from 'vue'
import Button from '@/components/Button.vue'
import {
  DEVICE_PREVIEW_BUSY_LINE,
  devicePreviewButton,
  devicePreviewDrawnLine,
  devicePreviewFailedLine,
  devicePreviewSignalLine,
  honestLine,
} from './pluginTemplateWording'

/**
 * What the honest line becomes once a device preview is asked for (ADR-0040): the button that starts it, the
 * drawing/busy/failed states, and once drawn, what it drew and when, with "Back to the browser drawing". Shared by
 * the Template editor and Edit HTML, whose honest line and button read exactly alike.
 */
const props = defineProps<{
  target: WordedTarget
  /** The size of what is drawn; Edit HTML is always `full`. */
  size: TemplateSize
  devicePreview: DevicePreviewState
}>()

const emit = defineEmits<{
  draw: []
  backToBrowser: []
}>()

const signalLine = computed(() => props.devicePreview.status === 'drawn' ? devicePreviewSignalLine(props.devicePreview.signal) : null)
</script>

<template>
  <template v-if="devicePreview.status === 'drawn'">
    <p class="honest">
      {{ devicePreviewDrawnLine(target, devicePreview.drawnAt) }}
    </p>
    <p v-if="signalLine" class="honest">
      {{ signalLine }}
    </p>
    <Button @click="emit('backToBrowser')">
      Back to the browser drawing
    </Button>
  </template>
  <template v-else>
    <p class="honest">
      {{ honestLine(target, size) }}
    </p>
    <p v-if="devicePreview.status === 'busy'" class="honest">
      {{ DEVICE_PREVIEW_BUSY_LINE }}
    </p>
    <p v-if="devicePreview.status === 'failed'" class="honest">
      {{ devicePreviewFailedLine(target.device) }}
    </p>
    <Button :loading="devicePreview.status === 'drawing'" @click="emit('draw')">
      {{ devicePreview.status === 'failed' ? 'Try again' : devicePreviewButton(target.device) }}
    </Button>
  </template>
</template>

<style scoped>
@layer components {
  .honest {
    margin-top: var(--space-2);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    text-wrap: pretty;
  }
}
</style>
