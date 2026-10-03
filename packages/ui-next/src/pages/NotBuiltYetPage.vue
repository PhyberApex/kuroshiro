<script setup lang="ts">
import { useRoute } from 'vue-router'
import EmptyState from '@/components/EmptyState.vue'
import TitleLine from '@/patterns/TitleLine.vue'

const route = useRoute()
</script>

<template>
  <TitleLine :title="route.meta.notBuiltYet ?? 'Kuroshiro'" />
  <EmptyState title="Not built yet">
    This page of the rebuilt admin UI has not landed. Your Devices keep polling and showing their Screens meanwhile.
  </EmptyState>
</template>
