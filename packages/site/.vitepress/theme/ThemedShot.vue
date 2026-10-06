<script setup lang="ts">
import type { ScreenshotName } from './screenshots'
import { withBase } from 'vitepress'
import { computed } from 'vue'
import { screenshotPath, screenshots } from './screenshots'

const props = defineProps<{ name: ScreenshotName, alt?: string }>()

const description = computed(() => props.alt ?? screenshots[props.name])
</script>

<template>
  <figure class="themed-shot">
    <img class="light" :src="withBase(screenshotPath(name, 'light'))" :alt="description" loading="lazy">
    <img class="dark" :src="withBase(screenshotPath(name, 'dark'))" :alt="description" loading="lazy">
    <figcaption>{{ description }}</figcaption>
  </figure>
</template>
