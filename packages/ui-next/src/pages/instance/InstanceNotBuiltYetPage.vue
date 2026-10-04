<script setup lang="ts">
import { useRoute } from 'vue-router'
import EmptyState from '@/components/EmptyState.vue'
import InstancePageHeading from './InstancePageHeading.vue'

const route = useRoute()
</script>

<template>
  <InstancePageHeading :title="route.meta.notBuiltYet ?? 'Instance'" />
  <EmptyState class="not-built-yet" title="Not built yet" heading="h3">
    This page of the rebuilt admin UI has not landed. Your Devices keep polling and showing their Screens meanwhile.
  </EmptyState>
</template>

<style scoped>
@layer components {
  .not-built-yet {
    margin-top: var(--space-6);
  }
}
</style>
