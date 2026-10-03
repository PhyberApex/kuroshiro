<script setup lang="ts">
import type { IconName } from './icons'
import Icon from './Icon.vue'
import Tooltip from './Tooltip.vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  icon: IconName
  /** The accessible name, and the text of the tooltip. */
  label: string
  disabled?: boolean
  /** Holds the tooltip open, for the gallery. */
  tooltipOpen?: boolean
}>(), {
  tooltipOpen: undefined,
})

if (import.meta.env.DEV && !props.label?.trim())
  throw new Error('An IconButton needs a label: it is the button\'s accessible name and its tooltip.')
</script>

<template>
  <Tooltip :text="label" :open="tooltipOpen">
    <button
      v-bind="$attrs"
      type="button"
      class="icon-button"
      :aria-label="label"
      :disabled="disabled"
    >
      <Icon :name="icon" />
    </button>
  </Tooltip>
</template>

<style scoped>
@layer components {
  .icon-button {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: var(--control-height);
    height: var(--control-height);
    border-radius: var(--radius);
    color: var(--color-ink-soft);
    transition:
      background-color var(--duration-quick) var(--ease-out),
      color var(--duration-quick) var(--ease-out),
      translate var(--duration-quick) var(--ease-out);
  }

  /* `data-force` holds a state still for the gallery, where no pointer is over the button. */
  .icon-button:not(:disabled):is(:hover, [data-force~='hover']) {
    background: var(--color-wash);
    color: var(--color-ink);
  }

  .icon-button:not(:disabled):active {
    background: var(--color-line);
    translate: 0 1px;
  }

  .icon-button:disabled {
    color: var(--color-line);
    cursor: default;
  }
}
</style>
