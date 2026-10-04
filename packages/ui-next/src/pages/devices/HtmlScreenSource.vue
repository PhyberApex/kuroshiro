<script setup lang="ts">
import type { ScreenRead } from 'kuroshiro-shared'
import { RouterLink } from 'vue-router'
import Button from '@/components/Button.vue'
import { editHtmlPath } from './devicePaths'

defineProps<{
  screen: ScreenRead
}>()
</script>

<template>
  <p>Rendered from HTML written here, on every poll.</p>
  <div>
    <Button as-child>
      <RouterLink :to="editHtmlPath(screen.deviceId, screen.id)">
        Edit HTML
      </RouterLink>
    </Button>
  </div>
</template>
