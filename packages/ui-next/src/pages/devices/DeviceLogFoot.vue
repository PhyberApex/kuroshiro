<script setup lang="ts">
import type { Sentence } from './sentence'
import Button from '@/components/Button.vue'
import SentenceLine from './SentenceLine.vue'

defineProps<{
  /** Whether the server holds entries older than the ones shown. */
  more: boolean
  loading: boolean
  /** How long entries are kept, once the Retention age is known. */
  retention?: Sentence
}>()

defineEmits<{
  older: []
}>()
</script>

<template>
  <div class="log-foot">
    <Button v-if="more" :loading="loading" @click="$emit('older')">
      Older entries
    </Button>
    <p v-else class="whole">
      That is the whole Device Log.
    </p>
    <SentenceLine v-if="retention" class="kept" :sentence="retention" />
  </div>
</template>

<style scoped>
@layer components {
  .log-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
    margin-top: var(--space-4);
    font-size: var(--text-sm);
  }

  .whole {
    color: var(--color-ink-soft);
  }
}
</style>
