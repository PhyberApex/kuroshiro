<script setup lang="ts">
import Icon from './Icon.vue'

defineOptions({ inheritAttrs: false })

defineProps<{
  disabled?: boolean
  invalid?: boolean
}>()

defineSlots<{
  /** The label. A checkbox without one needs an `aria-label`. */
  default?: () => unknown
}>()

const model = defineModel<boolean>({ default: false })
</script>

<template>
  <label class="checkbox" :class="{ disabled }">
    <span class="box">
      <input
        v-bind="$attrs"
        type="checkbox"
        class="input"
        :checked="model"
        :disabled="disabled"
        :aria-invalid="invalid || undefined"
        @change="model = ($event.target as HTMLInputElement).checked"
      >
      <Icon name="check" class="tick" />
    </span>
    <span v-if="$slots.default"><slot /></span>
  </label>
</template>

<style scoped>
@layer components {
  .checkbox {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--control-height);
    cursor: pointer;
  }

  .box {
    position: relative;
    flex: none;
  }

  .input {
    display: block;
    width: var(--icon);
    height: var(--icon);
    margin: 0;
    border: var(--rule-control);
    border-radius: var(--radius-inner);
    background: var(--color-paper);
    cursor: inherit;
    appearance: none;
    transition:
      background-color var(--duration-quick) var(--ease-out),
      border-color var(--duration-quick) var(--ease-out);
  }

  .input:checked {
    border-color: var(--color-ink);
    background: var(--color-ink);
  }

  .tick {
    position: absolute;
    inset: 0;
    color: var(--color-paper);
    pointer-events: none;
    visibility: hidden;
  }

  .input:checked + .tick {
    visibility: visible;
  }

  /* `data-force` holds a state still for the gallery, where no pointer is over the checkbox. */
  .checkbox:hover .input:not(:disabled),
  .input[data-force~='hover'] {
    border-color: var(--color-ink);
  }

  .checkbox:hover .input:checked:not(:disabled),
  .input:checked[data-force~='hover'] {
    border-color: var(--color-ink-hover);
    background: var(--color-ink-hover);
  }

  .input[aria-invalid='true'] {
    border-color: var(--color-ink);
    box-shadow: inset 0 0 0 1px var(--color-ink);
  }

  .disabled {
    color: var(--color-ink-soft);
    cursor: default;
  }

  .input:disabled {
    border-color: var(--color-line);
    background: var(--color-wash);
  }

  .input:checked:disabled {
    border-color: var(--color-ink-soft);
    background: var(--color-ink-soft);
  }
}
</style>
