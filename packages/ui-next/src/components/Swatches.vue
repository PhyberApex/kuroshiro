<script setup lang="ts">
defineProps<{
  /** A Palette's colours as CSS colours, in the Palette's order. What they are is said in words beside the squares. */
  colours: string[]
}>()
</script>

<template>
  <span class="swatches" aria-hidden="true">
    <i v-for="(colour, index) in colours" :key="index" class="square" :style="{ backgroundColor: colour }" />
  </span>
</template>

<style scoped>
@layer components {
  .swatches {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 3px;
    vertical-align: -3px;
  }

  /* The one place a colour that is not ink, paper or the seal is shown: the colour is the data. The border keeps a square that matches the page visible. */
  .square {
    box-sizing: border-box;
    width: 14px;
    height: 14px;
    border: 1px solid var(--color-ink-soft);
    border-radius: var(--radius-inner);
  }
}
</style>
