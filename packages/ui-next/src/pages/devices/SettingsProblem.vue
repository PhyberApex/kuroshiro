<script setup lang="ts">
import Icon from '@/components/Icon.vue'

defineSlots<{
  /** One sentence: why something in the section cannot be done on this Device. */
  default: () => unknown
}>()
</script>

<template>
  <p class="settings-problem">
    <Icon name="problem" class="mark" />
    <span><slot /></span>
  </p>
</template>

<style scoped>
@layer components {
  /* A problem is ink, never red: it is told by the icon. */
  .settings-problem {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    max-width: var(--measure);
    margin-top: var(--space-3);
  }

  .mark {
    flex: none;
    margin-top: 0.25em;
  }
}
</style>
