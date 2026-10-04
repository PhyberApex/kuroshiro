<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { listDeviceModels, listPalettes } from '@/api/device-models'
import Notice from '@/components/Notice.vue'
import PreviewPlate from '@/components/PreviewPlate.vue'
import { useLoad } from '@/patterns/useLoad'
import { htmlScreenDocument, shellTargetOf } from './htmlPreview'
import { rendersFor } from './screenSourceWording'

const props = defineProps<{
  /** The Device the HTML Screen is on: the preview is always for its Device Model and Palette. */
  device: DeviceDetail
  /** The markup as it is typed. */
  html: string
  /** The accessible name of the drawing: "Preview of Fridge note". */
  name: string
}>()

/** How long the typing has to pause before the markup is drawn again. */
const DRAWN_AFTER_MS = 200

/** The frame's shape while it is not known what the Device's panel is: TRMNL's own. */
const USUAL_PANEL = { width: 800, height: 480 }

const headingId = useId()

const sizing = useLoad(async () => {
  const [{ models }, palettes] = await Promise.all([listDeviceModels(), listPalettes()])
  return { models, palettes }
})

const target = computed(() => sizing.data && shellTargetOf(props.device, sizing.data.models, sizing.data.palettes))
const panel = computed(() => target.value?.model ?? props.device.deviceModel ?? USUAL_PANEL)
const madeFor = computed(() => rendersFor(props.device))

const drawn = ref(props.html)
let pause: ReturnType<typeof setTimeout> | undefined

watch(() => props.html, (html) => {
  clearTimeout(pause)
  pause = setTimeout(() => (drawn.value = html), DRAWN_AFTER_MS)
})
onBeforeUnmount(() => clearTimeout(pause))
</script>

<template>
  <div class="html-preview" role="group" :aria-labelledby="headingId">
    <p :id="headingId" class="heading">
      <span class="label">Preview</span>
      {{ ' ' }}
      <span v-if="madeFor" class="for">as {{ device.name }} renders it: {{ madeFor }}</span>
    </p>
    <Notice v-if="sizing.failure" title="Could not load the preview." :reason="sizing.failure.reason" action="Try again" @act="sizing.reload" />
    <p v-else-if="sizing.data && !target" class="none">
      No preview: this Instance does not know {{ device.name }}'s Device Model and Palette.
    </p>
    <PreviewPlate
      v-else
      :name="name"
      :document="target ? htmlScreenDocument(target, drawn) : null"
      :width="panel.width"
      :height="panel.height"
      :rendering="!target"
      rendering-note="Loading the preview"
    />
  </div>
</template>

<style scoped>
@layer components {
  .heading {
    padding-bottom: var(--space-1);
  }

  .label {
    font-weight: var(--weight-medium);
  }

  .for,
  .none {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
