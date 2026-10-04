<script setup lang="ts">
import Button from './Button.vue'

defineProps<{
  /** What could not be done: "Kitchen's Logs could not be loaded." */
  title: string
  /** The server's reason, when it gave one. */
  reason?: string
  /** The label of the action that may put it right ("Try again"). Left out, there is no button. */
  action?: string
}>()

defineEmits<{
  act: []
}>()
</script>

<template>
  <div class="notice">
    <p class="said" role="alert">
      <b>{{ title }}</b> <span v-if="reason">{{ reason }}</span>
    </p>
    <Button v-if="action" @click="$emit('act')">
      {{ action }}
    </Button>
  </div>
</template>

<style scoped>
@layer components {
  /* An error is ink, never red: the notice is told by its heavy rule and its weight. */
  .notice {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3) var(--space-6);
    padding: var(--space-3) 0;
    border-top: var(--rule-heavy);
    border-bottom: var(--rule);
  }

  .said {
    max-width: var(--measure);
  }

  .said b {
    font-weight: var(--weight-semibold);
  }
}
</style>
