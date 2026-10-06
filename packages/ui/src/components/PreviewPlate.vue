<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import Icon from './Icon.vue'
import LoadingMark from './LoadingMark.vue'
import Plate from './Plate.vue'

const props = defineProps<{
  /** The accessible name of the drawing: "Preview of Weather". */
  name: string
  /** A complete HTML document, drawn in a sandboxed frame. It is kept while `notDrawn` is set; `null` empties the plate. */
  document: string | null
  /** The Device Model's panel, in its own pixels. The frame is laid out at this size and scaled down to the plate. */
  width: number
  height: number
  /** The document could not be made anew: the last drawing stays, dimmed, under a note. */
  notDrawn?: boolean
  /** There is nothing to draw with yet: the plate shows the dither. */
  rendering?: boolean
  /** What the plate is waiting for while it is rendering: "Fetching the data". */
  renderingNote?: string
  /** The drawing is kept while something else draws over it, with the loading mark: "Drawing it as {Device} shows it" (ADR-0040). */
  drawingNote?: string
}>()

interface Drawing {
  id: number
  document: string
  arrived: boolean
}

const drawings = ref<Drawing[]>([])
let lastDrawingId = 0

// A new document is drawn in a frame of its own, out of sight, and the one before it stays until that frame has loaded.
watch(() => props.rendering ? null : props.document, (document) => {
  const shown = drawings.value.filter(drawing => drawing.arrived)
  drawings.value = document === null ? [] : [...shown, { id: ++lastDrawingId, document, arrived: false }]
}, { immediate: true })

function arrived(id: number) {
  drawings.value = drawings.value.filter(drawing => drawing.id === id).map(drawing => ({ ...drawing, arrived: true }))
}

const hasDrawing = computed(() => drawings.value.some(drawing => drawing.arrived))
const redrawing = computed(() => drawings.value.some(drawing => !drawing.arrived))

const stage = useTemplateRef('stage')
const stageWidth = ref(0)
const stageResizes = new ResizeObserver(([entry]) => stageWidth.value = entry.contentRect.width)

watch(stage, (element) => {
  stageResizes.disconnect()
  if (element) {
    stageWidth.value = element.clientWidth
    stageResizes.observe(element)
  }
})
onBeforeUnmount(() => stageResizes.disconnect())

const frameStyle = computed(() => ({
  width: `${props.width}px`,
  height: `${props.height}px`,
  transform: `scale(${stageWidth.value / props.width})`,
}))
</script>

<template>
  <Plate :name="name" :width="width" :height="height" :rendering="rendering" :rendering-note="renderingNote">
    <template v-if="!rendering" #default>
      <div ref="stage" class="drawing" :class="{ dimmed: notDrawn }" :aria-busy="redrawing || undefined">
        <iframe
          v-for="drawing in drawings"
          :key="drawing.id"
          class="frame"
          :class="{ arriving: !drawing.arrived }"
          sandbox="allow-scripts"
          :srcdoc="drawing.document"
          :title="name"
          :style="frameStyle"
          tabindex="-1"
          @load="arrived(drawing.id)"
        />
        <p v-if="notDrawn" class="note">
          <Icon name="problem" />
          {{ hasDrawing ? 'Not drawn. This is the last drawing.' : 'Not drawn.' }}
        </p>
        <p v-else-if="drawingNote" class="note">
          <LoadingMark decorative />
          {{ drawingNote }}
        </p>
      </div>
    </template>
  </Plate>
</template>

<style scoped>
@layer components {
  /*
  Clipped square: the plate's outline is painted over the frame's corners, and a rounded clip of a scaled frame is
  antialiased differently from one run to the next, which no screenshot baseline survives.
  */
  .drawing {
    position: relative;
    place-self: stretch;
    overflow: hidden;
  }

  /* The panel does not follow the theme, so neither does what is drawn for it. */
  .frame {
    position: absolute;
    top: 0;
    left: 0;
    border: 0;
    background: var(--color-plate);
    color-scheme: light;
    transform-origin: 0 0;
    pointer-events: none;
  }

  .arriving {
    visibility: hidden;
  }

  .dimmed .frame {
    opacity: 0.4;
  }

  .note {
    position: absolute;
    bottom: var(--space-3);
    left: var(--space-3);
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    max-width: calc(100% - 2 * var(--space-3));
    padding: var(--space-1) var(--space-2);
    outline: 1px solid var(--color-plate-ink);
    background: var(--color-plate);
    color: var(--color-plate-ink);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }
}
</style>
