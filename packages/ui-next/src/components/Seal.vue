<script setup lang="ts">
import { computed } from 'vue'
import { sealDrawingAt } from './sealDrawing'

const props = withDefaults(defineProps<{
  /** The side in CSS pixels at the default text size. It picks the drawing: 黒白 from 20 up, 白 alone below. */
  size?: number
  /** `seal` is the vermilion, rationed to the Active Screen and the brand; `ink` is every other place. */
  colour?: 'seal' | 'ink'
  /** Lands the seal once as it is mounted, where motion is allowed. To stamp again, mount it anew with a `key`. */
  stamps?: boolean
  /** A seal is decorative unless it is given a label, which makes it an image with that name. */
  label?: string
}>(), {
  size: 40,
  colour: 'seal',
})

const drawing = computed(() => sealDrawingAt(props.size))
const side = computed(() => `${props.size / 16}rem`)
</script>

<template>
  <svg
    class="seal"
    :class="[`in-${colour}`, { stamps }]"
    :viewBox="`0 0 ${drawing.grid} ${drawing.grid}`"
    :style="{ width: side, height: side }"
    focusable="false"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : true"
  >
    <rect :width="drawing.grid" :height="drawing.grid" :rx="drawing.cornerRadius" />
    <path class="characters" fill-rule="evenodd" :d="drawing.characters" />
  </svg>
</template>

<style scoped>
@layer components {
  .seal {
    flex: none;
    fill: var(--color-ink);
  }

  .in-seal {
    fill: var(--color-seal);
  }

  /* The characters are cut from the square: they take the colour of what the seal sits on, which a plate sets. */
  .seal .characters {
    fill: var(--seal-ground, var(--color-paper));
  }

  @media (prefers-reduced-motion: no-preference) {
    .stamps {
      animation: stamp var(--duration-move) var(--ease-out);
    }
  }

  @keyframes stamp {
    from {
      opacity: 0;
      scale: 1.35;
    }
  }
}
</style>
