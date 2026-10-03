<script setup lang="ts">
import { computed, onBeforeUpdate, ref, watch } from 'vue'
import Icon from './Icon.vue'
import LoadingMark from './LoadingMark.vue'
import Seal from './Seal.vue'

const props = withDefaults(defineProps<{
  /** The accessible name of what the plate shows: "On Kitchen: Calendar". */
  name: string
  /** The address of the Screen image. Without one, and without a default slot, the plate is rendering. */
  src?: string | null
  /** `current` is the Current Screen at 576 px, `preview` fills the width it is given, `list` is 168 px (112 px on phone), `row` 72 px. */
  size?: 'current' | 'preview' | 'list' | 'row'
  /** The panel of the Device Model. They set the frame's shape before the image is known; left out, the frame takes the image's own. */
  width?: number
  height?: number
  /** The red seal: only while the plate shows the Active Screen's image. */
  sealed?: boolean
  /** What the seal marks, such as the Active Screen's id. The seal stamps when it changes. */
  stampKey?: string
  /** Dims the image of a Screen that Rotation passes over. */
  passedOver?: boolean
  /** The dither of an image that is still being rendered. */
  rendering?: boolean
  /** The error state. An image that cannot be loaded puts the plate in it by itself. */
  failed?: boolean
  /** Loads the image only as it scrolls into view. */
  lazy?: boolean
}>(), {
  size: 'preview',
})

const slots = defineSlots<{
  /** What stands inside the frame in place of the image. */
  default?: () => unknown
}>()

if (import.meta.env.DEV && !props.name?.trim())
  throw new Error('A Plate needs a name: it is the text alternative of the Screen image.')

const DEFAULT_PANEL = { width: 800, height: 480 }
const SEAL_SIZES = { current: 56, preview: 40, list: 24, row: 16 } as const

const imageSize = ref<{ width: number, height: number }>()
const unloadable = ref(false)

watch(() => props.src, () => {
  imageSize.value = undefined
  unloadable.value = false
})

// `slots` is not reactive, so whether the frame holds something of the caller's is read again at every render.
const holdsSlot = ref(Boolean(slots.default))
onBeforeUpdate(() => {
  holdsSlot.value = Boolean(slots.default)
})

const WITHOUT_IMAGE = {
  rendering: { said: 'rendering', words: 'Rendering' },
  failed: { said: 'no image yet', words: 'No image yet' },
} as const

const state = computed(() => {
  if (holdsSlot.value)
    return 'held'
  if (props.failed || unloadable.value)
    return 'failed'
  if (props.rendering || !props.src)
    return 'rendering'
  return 'image'
})

const panel = computed(() => props.width && props.height
  ? { width: props.width, height: props.height }
  : imageSize.value ?? DEFAULT_PANEL)

const frame = computed(() => {
  if (state.value === 'image')
    return {}
  if (state.value === 'held')
    return { 'role': 'group', 'aria-label': props.name }
  return { 'role': 'img', 'aria-label': `${props.name}: ${WITHOUT_IMAGE[state.value].said}` }
})

const stampCount = ref(0)
watch(() => props.stampKey, () => stampCount.value++)

function takeImageSize(event: Event) {
  const { naturalWidth, naturalHeight } = event.target as HTMLImageElement
  if (naturalWidth > 0 && naturalHeight > 0)
    imageSize.value = { width: naturalWidth, height: naturalHeight }
}
</script>

<template>
  <div
    class="plate"
    :class="[size, `is-${state}`, { 'passed-over': passedOver }]"
    :style="{ aspectRatio: `${panel.width} / ${panel.height}` }"
    v-bind="frame"
  >
    <slot v-if="state === 'held'" />
    <img
      v-else-if="state === 'image'"
      class="image"
      :src="src!"
      :alt="name"
      :loading="lazy ? 'lazy' : undefined"
      decoding="async"
      @load="takeImageSize"
      @error="unloadable = true"
    >
    <span v-else class="note" aria-hidden="true">
      <LoadingMark v-if="state === 'rendering'" decorative />
      <Icon v-else name="problem" />
      <span class="words">{{ WITHOUT_IMAGE[state].words }}</span>
    </span>
    <Seal
      v-if="sealed"
      :key="stampCount"
      class="mark"
      :size="SEAL_SIZES[size]"
      :stamps="stampCount > 0"
    />
  </div>
</template>

<style scoped>
@layer components {
  .plate {
    --seal-ground: var(--color-plate);

    position: relative;
    display: grid;
    flex: none;
    place-items: center;
    width: 100%;
    border-radius: var(--radius-plate);
    outline: var(--rule-heavy);
    background: var(--color-plate);
    color: var(--color-plate-ink);
  }

  .current {
    max-width: var(--plate-hero);
  }

  .list {
    width: 10.5rem;
  }

  .row {
    width: 4.5rem;
  }

  .image {
    width: 100%;
    height: 100%;
    border-radius: var(--radius-plate);
    object-fit: contain;
  }

  .plate.passed-over > :not(.mark) {
    opacity: 0.45;
  }

  /* A panel refreshing: the two plate colours as a 4 px checker. */
  .is-rendering {
    background: repeating-conic-gradient(var(--color-plate-ink) 0 25%, var(--color-plate) 0 50%) 0 0 / 4px 4px;
  }

  .note {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    max-width: 90%;
    padding: var(--space-1) var(--space-2);
    background: var(--color-plate);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  /* A thumbnail has no room for the words, which the frame's name says anyway. */
  .plate:is(.list, .row) .words {
    display: none;
  }

  .plate.row .note {
    padding: var(--space-1);
  }

  /*
  The seal hangs over the top right corner by a quarter of its side. It stands straight, where the drawing has it 4 degrees
  askew: a rotated edge is rastered a few pixels differently from one run to the next, which no screenshot baseline survives.
  */
  .mark {
    position: absolute;
    top: -0.375rem;
    right: -0.375rem;
  }

  .plate.preview > .mark {
    top: -0.625rem;
    right: -0.625rem;
  }

  .plate.current > .mark {
    top: -0.875rem;
    right: -0.875rem;
  }

  @media (max-width: 820px) {
    .list {
      width: 7rem;
    }

  }
}
</style>
