<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

defineOptions({ inheritAttrs: false })

defineProps<{
  disabled?: boolean
  /** The look while the change is being saved: the thumb blinks and the switch is busy. */
  saving?: boolean
  /** The look after a change that could not be saved: the border doubles. */
  error?: boolean
}>()

defineSlots<{
  /** The label. A switch without one needs an `aria-label`. */
  default?: () => unknown
  /** The save state, beside the switch. */
  status?: () => unknown
}>()

const model = defineModel<boolean>({ default: false })
</script>

<template>
  <span class="line">
    <label class="switch" :class="{ disabled }">
      <SwitchRoot
        v-bind="$attrs"
        v-model="model"
        class="track"
        :class="{ error }"
        :disabled="disabled"
        :aria-busy="saving || undefined"
      >
        <SwitchThumb class="thumb" />
      </SwitchRoot>
      <span v-if="$slots.default"><slot /></span>
    </label>
    <slot name="status" />
  </span>
</template>

<style scoped>
@layer components {
  .line {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
  }

  .switch {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--control-height);
    cursor: pointer;
  }

  .track {
    position: relative;
    flex: none;
    width: 2rem;
    height: 1rem;
    border: 1px solid var(--color-ink);
    border-radius: var(--radius);
    transition:
      background-color var(--duration-quick) var(--ease-out),
      border-color var(--duration-quick) var(--ease-out);
  }

  /* The track is 32 by 16 px; this is the 44 px square a finger or a near miss lands on. */
  .track::before {
    content: "";
    position: absolute;
    inset: -15px -7px;
  }

  .thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 10px;
    height: 10px;
    border-radius: var(--radius-inner);
    background: var(--color-ink);
    transition: translate var(--duration-quick) var(--ease-out);
  }

  .track[aria-checked='true'] {
    background: var(--color-ink);
  }

  .track[aria-checked='true'] .thumb {
    background: var(--color-paper);
    translate: 16px 0;
  }

  /* `data-force` holds a state still for the gallery, where no pointer is over the switch. */
  .switch:hover .track:not(:disabled),
  .track[data-force~='hover'] {
    background: var(--color-wash);
  }

  .switch:hover .track[aria-checked='true']:not(:disabled),
  .track[aria-checked='true'][data-force~='hover'] {
    border-color: var(--color-ink-hover);
    background: var(--color-ink-hover);
  }

  /* An error is ink, never red: the border doubles. On a filled track the second line is paper. */
  .track.error {
    box-shadow: inset 0 0 0 1px var(--color-ink);
  }

  .track.error[aria-checked='true'] {
    box-shadow: inset 0 0 0 1px var(--color-paper);
  }

  .track[aria-busy='true'] .thumb {
    animation: blink 1s steps(1) infinite;
  }

  .disabled {
    color: var(--color-ink-soft);
    cursor: default;
  }

  .track:disabled {
    border-color: var(--color-line);
    cursor: default;
  }

  .track:disabled .thumb {
    background: var(--color-line);
  }

  .track[aria-checked='true']:disabled {
    background: var(--color-line);
  }

  .track[aria-checked='true']:disabled .thumb {
    background: var(--color-paper);
  }

  @keyframes blink {
    50% { opacity: 0; }
  }

  /* Without the blink, saving is a hollow thumb. */
  @media (prefers-reduced-motion: reduce) {
    .track[aria-busy='true'] .thumb {
      box-shadow: inset 0 0 0 2px var(--color-ink);
      background: none;
      animation: none;
    }

    .track[aria-busy='true'][aria-checked='true'] .thumb {
      box-shadow: inset 0 0 0 2px var(--color-paper);
    }
  }
}
</style>
