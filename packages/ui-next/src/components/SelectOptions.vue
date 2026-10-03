<template>
  <div class="options">
    <slot />
  </div>
</template>

<style scoped>
@layer components {
  /* No shadow: a layer above the page is drawn with an ink border. The list is as wide as its control at least. */
  .options {
    min-width: max(12rem, var(--reka-select-trigger-width, var(--reka-combobox-trigger-width)));
    max-width: calc(100vw - var(--space-4));
    max-height: min(20rem, var(--reka-select-content-available-height, var(--reka-combobox-content-available-height)));
    padding: var(--space-1);
    overflow-y: auto;
    border: 1px solid var(--color-ink);
    border-radius: var(--radius);
    background: var(--color-paper);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  /* The options are Reka's elements inside a teleported layer, so they are reached from the list, which is ours. */
  .options :deep(.option) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-height: var(--control-height);
    padding: 0 var(--space-2);
    border-radius: var(--radius-inner);
    outline: none;
    cursor: pointer;
  }

  .options :deep(.option[data-highlighted]) {
    background: var(--color-ink);
    color: var(--color-paper);
  }

  .options :deep(.option[data-disabled]) {
    color: var(--color-ink-soft);
    cursor: default;
  }

  .options :deep(.reason) {
    margin-left: auto;
    font-family: var(--font-text);
  }

  .options :deep(.nothing) {
    display: flex;
    align-items: center;
    min-height: var(--control-height);
    padding: 0 var(--space-2);
    color: var(--color-ink-soft);
    font-family: var(--font-text);
  }

  @media (pointer: coarse) {
    .options {
      font-size: var(--text-lg);
    }
  }
}
</style>
