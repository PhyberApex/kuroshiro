<script setup lang="ts">
import type { Sentence } from './sentence'
import { RouterLink } from 'vue-router'

defineProps<{
  sentence: Sentence
}>()
</script>

<template>
  <p class="sentence-line">
    <template v-for="(part, index) in sentence" :key="index">
      <b v-if="part.strong" class="name">{{ part.text }}</b>
      <span v-else-if="part.mono" class="value">{{ part.text }}</span>
      <RouterLink v-else-if="part.to" v-slot="{ href, navigate }" custom :to="part.to">
        <a class="link" :href="href" @click="navigate">{{ part.text }}</a>
      </RouterLink>
      <span v-else>{{ part.text }}</span>
    </template>
  </p>
</template>

<style scoped>
@layer components {
  .sentence-line {
    color: var(--color-ink-soft);
  }

  .name {
    color: var(--color-ink);
    font-weight: var(--weight-semibold);
  }

  .value {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }

  .link {
    color: var(--color-ink);
    text-underline-offset: 3px;
    transition: color var(--duration-quick) var(--ease-out);
  }

  .link:hover {
    color: var(--color-ink-hover);
  }
}
</style>
