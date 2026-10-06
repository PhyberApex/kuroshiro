<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import { viewFull } from 'kuroshiro-shared'
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { listDeviceModels, listPalettes } from '@/api/device-models'
import Notice from '@/components/Notice.vue'
import PreviewPlate from '@/components/PreviewPlate.vue'
import DevicePreviewLines from '@/pages/plugins/DevicePreviewLines.vue'
import { devicePreviewDrawingLine, targetFacts } from '@/pages/plugins/pluginTemplateWording'
import { useDevicePreview } from '@/pages/plugins/useDevicePreview'
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
  /** The bench's wording: the facts and what the plate is not, under it, in place of the label above it that Add Screen's form has. The device preview (ADR-0040) is offered only here. */
  facts?: boolean
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
const worded = computed(() => target.value && { ...target.value, device: props.device })

const drawn = ref(props.html)
let pause: ReturnType<typeof setTimeout> | undefined

watch(() => props.html, (html) => {
  clearTimeout(pause)
  pause = setTimeout(() => (drawn.value = html), DRAWN_AFTER_MS)
})
onBeforeUnmount(() => clearTimeout(pause))

/** Offered only with `facts`: Add Screen's HTML kind, which has no saved Screen yet, is out of scope for the device preview. */
const devicePreview = useDevicePreview(() => props.facts && target.value
  ? { html: viewFull(drawn.value), deviceModelName: target.value.model.name, paletteId: target.value.palette.id, width: target.value.model.width, height: target.value.model.height }
  : undefined)

const shownDocument = computed(() => devicePreview.state.value.status === 'drawn' ? devicePreview.state.value.document : (target.value ? htmlScreenDocument(target.value, drawn.value) : null))
const drawingNote = computed(() => devicePreview.state.value.status === 'drawing' ? devicePreviewDrawingLine(props.device) : undefined)
</script>

<template>
  <div class="html-preview" role="group" :aria-labelledby="headingId">
    <p v-if="!facts" :id="headingId" class="heading">
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
      :name="devicePreview.state.value.status === 'drawn' ? `${name} as ${device.name} shows it` : name"
      :document="shownDocument"
      :width="panel.width"
      :height="panel.height"
      :rendering="!target"
      rendering-note="Loading the preview"
      :drawing-note="drawingNote"
    />
    <template v-if="facts">
      <p :id="headingId" class="facts">
        Preview for {{ device.name }}<template v-if="worded">
          · <span class="mono">{{ targetFacts(worded) }}</span>
        </template>
      </p>
      <DevicePreviewLines
        v-if="worded"
        :target="worded"
        size="full"
        :device-preview="devicePreview.state.value"
        @draw="devicePreview.draw"
        @back-to-browser="devicePreview.backToBrowser"
      />
    </template>
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
  .none,
  .facts {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .facts {
    margin-top: var(--space-2);
    text-wrap: pretty;
  }

  .mono {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }
}
</style>
