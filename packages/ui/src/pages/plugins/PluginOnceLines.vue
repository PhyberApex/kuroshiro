<script setup lang="ts">
import type { OnceLine } from './pluginPageWording'
import { RouterLink } from 'vue-router'
import LineShownOnce from '@/components/LineShownOnce.vue'

defineProps<{
  /** Each with the `key` that tells one happening from the next: a second save is a new line. */
  lines: Array<OnceLine & { key: string }>
}>()
</script>

<template>
  <div v-if="lines.length > 0" class="plugin-once-lines">
    <LineShownOnce v-for="line in lines" :key="line.key">
      {{ line.text }}
      <RouterLink v-if="line.back" v-slot="{ href, navigate }" custom :to="line.back.to">
        <a class="back" :href="href" @click="navigate">{{ line.back.label }}</a>
      </RouterLink>
    </LineShownOnce>
  </div>
</template>

<style scoped>
@layer components {
  .plugin-once-lines {
    display: grid;
    gap: var(--space-2);
    margin-top: var(--space-4);
  }

  .back {
    font-weight: var(--weight-medium);
    text-underline-offset: 3px;
    transition: color var(--duration-quick) var(--ease-out);
  }

  .back:hover {
    color: var(--color-ink-hover);
  }
}
</style>
