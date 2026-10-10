<script setup lang="ts">
import type { ProblemLine } from './problemLine'
import { RouterLink } from 'vue-router'
import Icon from './Icon.vue'

defineProps<{
  lines: ProblemLine[]
}>()
</script>

<template>
  <ul v-if="lines.length > 0" class="problem-lines">
    <li v-for="line in lines" :key="line.text" class="line">
      <span class="said" :class="line.kind">
        <span v-if="line.kind === 'alert'" class="seal-chip" aria-hidden="true" />
        <Icon v-else name="problem" class="mark" />
        <span>{{ line.text }}</span>
      </span>
      <RouterLink v-if="line.link" class="link row-link" :to="line.link.to">
        {{ line.link.label }}
      </RouterLink>
    </li>
  </ul>
</template>

<style scoped>
@layer components {
  .problem-lines {
    border-top: var(--rule);
  }

  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-1) var(--space-4);
    padding: var(--space-2) 0;
    border-bottom: var(--rule);
  }

  .said {
    display: inline-flex;
    align-items: flex-start;
    gap: var(--space-2);
    font-weight: var(--weight-medium);
  }

  /* The seal colour is rationed: of everything that reports trouble, only a firing Alert wears it. */
  .alert {
    color: var(--color-seal);
  }

  .problem-lines .mark {
    margin-top: calc((1lh - var(--icon)) / 2);
  }

  .link {
    font-weight: var(--weight-medium);
    white-space: nowrap;
  }
}
</style>
