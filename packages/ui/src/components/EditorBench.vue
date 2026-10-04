<script setup lang="ts">
defineProps<{
  /** The bench takes the height of its place: the editor fills it and the preview column scrolls by itself. Below 820 px it stacks like the bench on the page. */
  fullWindow?: boolean
}>()

defineSlots<{
  /** The code editor: `size="bench"`, or `size="full-window"` in the full window. */
  editor: () => unknown
  plate: () => unknown
  /** What sits under the plate: the facts, the honest line, the notices, "Data". */
  default?: () => unknown
}>()
</script>

<template>
  <div class="editor-bench" :class="{ 'full-window': fullWindow }">
    <div class="editor">
      <slot name="editor" />
    </div>
    <div class="preview" :tabindex="fullWindow ? 0 : undefined">
      <slot name="plate" />
      <slot />
    </div>
  </div>
</template>

<style scoped>
@layer components {
  .editor-bench {
    display: grid;
    grid-template-columns: minmax(0, 6fr) minmax(0, 5fr);
    align-items: start;
    gap: var(--space-6);
  }

  .editor {
    min-width: 0;
    min-height: 0;
  }

  /* The plate's outline lies outside its box, so the column keeps its width clear on every side. */
  .preview {
    min-width: 0;
    padding: 2px 2px 0;
  }

  .full-window {
    grid-template-columns: minmax(0, 1fr) minmax(22rem, 40%);
    align-items: stretch;
    height: 100%;
    min-height: 0;
  }

  /* It scrolls by itself, and `tabindex="0"` makes it reachable by keyboard to be scrolled by it. */
  .full-window .preview {
    padding-bottom: var(--space-6);
    overflow-y: auto;
  }

  @media (max-width: 820px) {
    .editor-bench {
      grid-template-columns: minmax(0, 1fr);
      align-items: start;
      gap: var(--space-4);
      height: auto;
    }

    .full-window .preview {
      padding-bottom: 0;
      overflow-y: visible;
    }
  }
}
</style>
