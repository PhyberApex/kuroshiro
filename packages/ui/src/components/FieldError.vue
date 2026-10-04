<script setup lang="ts">
import Icon from './Icon.vue'

defineProps<{
  /** What is wrong and what is allowed. Left out, nothing shows. */
  message?: string
}>()
</script>

<template>
  <div class="field-error" aria-live="polite">
    <p v-if="message" class="message">
      <Icon name="problem" class="mark" />{{ message }}
    </p>
  </div>
</template>

<style scoped>
@layer components {
  /* The live region is there before its message, or a screen reader does not announce the message. Empty, it takes no room. */
  .message {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    padding-top: var(--space-1);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .mark {
    margin-top: 1px;
  }
}
</style>
