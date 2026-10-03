<script setup lang="ts">
withDefaults(defineProps<{
  /** How much of its place the bar takes, as a CSS length: the rough width of the text it stands for. */
  width?: string
}>(), {
  width: '100%',
})
</script>

<template>
  <span class="wash-bar" :style="{ width }" aria-hidden="true" />
</template>

<style scoped>
@layer components {
  .wash-bar {
    display: block;
    max-width: 100%;
    height: var(--space-3);
    border-radius: var(--radius-inner);
    background: var(--color-wash);
  }
}
</style>
