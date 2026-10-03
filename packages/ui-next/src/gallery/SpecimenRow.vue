<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <div class="row">
    <h3 v-if="title" class="title">
      {{ title }}
    </h3>
    <div class="specimens">
      <slot />
    </div>
  </div>
</template>

<style scoped>
@layer components {
  .row {
    padding-block: var(--space-5);
    border-bottom: var(--rule);
  }

  .title {
    margin-bottom: var(--space-4);
    font-size: var(--text-md);
    font-weight: var(--weight-semibold);
  }

  .specimens {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--space-5) var(--space-6);
  }
}
</style>
