<script setup lang="ts">
import { Primitive } from 'reka-ui'
import { computed } from 'vue'
import LoadingMark from './LoadingMark.vue'

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'plain' | 'quiet'
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  /** Shows the loading mark in place of the label. The button keeps its width, its name and the focus, and does not fire. Only a `button` shows the mark; a link has nothing to wait for. */
  loading?: boolean
  /** Gives the button's looks to its one child, a router link or an anchor, instead of rendering a `button`. */
  asChild?: boolean
}>(), {
  variant: 'plain',
  type: 'button',
})

const unpressable = computed(() => props.disabled || props.loading)

function swallowWhileUnpressable(event: MouseEvent) {
  if (!unpressable.value)
    return
  event.preventDefault()
  event.stopImmediatePropagation()
}
</script>

<template>
  <Primitive
    as="button"
    :as-child="asChild"
    class="button"
    :class="variant"
    :type="asChild ? undefined : type"
    :disabled="(!asChild && disabled) || undefined"
    :aria-disabled="(asChild ? unpressable : loading) || undefined"
    :aria-busy="loading || undefined"
    @click.capture="swallowWhileUnpressable"
  >
    <slot v-if="asChild" />
    <template v-else>
      <span class="label"><slot /></span>
      <LoadingMark v-if="loading" class="mark" decorative />
    </template>
  </Primitive>
</template>

<style scoped>
@layer components {
  .button {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--control-height);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-ink);
    border-radius: var(--radius);
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    white-space: nowrap;
    text-decoration: none;
    cursor: pointer;
    transition:
      background-color var(--duration-quick) var(--ease-out),
      border-color var(--duration-quick) var(--ease-out),
      color var(--duration-quick) var(--ease-out),
      translate var(--duration-quick) var(--ease-out);
  }

  .button,
  .label {
    gap: var(--space-2);
  }

  .label {
    display: inline-flex;
    align-items: center;
  }

  .primary {
    background: var(--color-ink);
    color: var(--color-paper);
  }

  .quiet {
    padding-inline: 0;
    border-color: transparent;
    font-weight: var(--weight-medium);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  /* `data-force` holds a state still for the gallery, where no pointer is over the button. */
  .button:not(:disabled, [aria-disabled='true']):is(:hover, [data-force~='hover']) {
    background: var(--color-wash);
  }

  .button:not(:disabled, [aria-disabled='true']):is(:active, [data-force~='active']) {
    background: var(--color-line);
    translate: 0 1px;
  }

  .primary:not(:disabled, [aria-disabled='true']):is(:hover, [data-force~='hover']) {
    border-color: var(--color-ink-hover);
    background: var(--color-ink-hover);
  }

  .primary:not(:disabled, [aria-disabled='true']):is(:active, [data-force~='active']) {
    border-color: var(--color-ink-soft);
    background: var(--color-ink-soft);
  }

  .quiet:not(:disabled, [aria-disabled='true']):is(:hover, :active, [data-force~='hover'], [data-force~='active']) {
    background: none;
    color: var(--color-ink-soft);
  }

  .button:is(:disabled, [aria-disabled='true']):not([aria-busy='true']) {
    border-color: var(--color-line);
    background: none;
    color: var(--color-ink-soft);
    cursor: default;
  }

  .quiet:is(:disabled, [aria-disabled='true']):not([aria-busy='true']) {
    border-color: transparent;
    text-decoration: none;
  }

  .button[aria-busy='true'] {
    cursor: progress;
  }

  /* Hidden by opacity, not visibility: the label still holds the width and still names the button. */
  .button[aria-busy='true'] .label {
    opacity: 0;
  }

  .mark {
    position: absolute;
    inset: 0;
    margin: auto;
  }
}
</style>
