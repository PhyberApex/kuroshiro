<script setup lang="ts">
import type { DeviceModelRead } from 'kuroshiro-shared'
import Notice from '@/components/Notice.vue'
import PreviewPlate from '@/components/PreviewPlate.vue'

/** The plate of the Template section, or why there is none: what it is drawn with could not be loaded, or the Instance holds nothing to draw it for. */
defineProps<{
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
}>()

defineEmits<{
  retry: []
}>()
</script>

<template>
  <Notice v-if="loadFailure" title="Could not load the preview." :reason="loadFailure" action="Try again" @act="$emit('retry')" />
  <p v-else-if="nothingToDrawFor" class="none">
    No preview: this Instance holds no Device Model with a Palette to draw it for.
  </p>
  <PreviewPlate
    v-else
    :name="`Preview of ${pluginName}`"
    :document="document"
    :width="model?.width ?? 800"
    :height="model?.height ?? 480"
    :not-drawn="notDrawn"
    :rendering="!model || !hasData"
    :rendering-note="waitingFor"
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
