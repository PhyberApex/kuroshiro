<script setup lang="ts">
import Icon from './Icon.vue'

defineProps<{
  label: string
  copied: boolean
}>()
</script>

<template>
  <span class="faces">
    <span class="face" :class="{ shown: !copied }"><Icon name="copy" />{{ label }}</span>
    <span class="face" :class="{ shown: copied }"><Icon name="check" />Copied</span>
  </span>
</template>

<style scoped>
@layer components {
  /* Both faces share one cell, so the button is as wide as the wider one and does not jump. */
  .faces {
    display: grid;
  }

  .face {
    display: inline-flex;
    grid-area: 1 / 1;
    align-items: center;
    gap: var(--space-2);
    visibility: hidden;
  }

  .face.shown {
    visibility: visible;
  }
}
</style>
