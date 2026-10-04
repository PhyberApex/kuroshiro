<script setup lang="ts">
import EmptyState from '@/components/EmptyState.vue'
</script>

<template>
  <EmptyState class="not-built-yet" title="Not built yet">
    This page of the rebuilt admin UI has not landed. Your Devices keep polling and showing their Screens meanwhile.
  </EmptyState>
</template>

<style scoped>
@layer components {
  .not-built-yet {
    margin-top: var(--space-8);
  }

  @media (max-width: 820px) {
    .not-built-yet {
      margin-top: var(--space-6);
    }
  }
}
</style>
