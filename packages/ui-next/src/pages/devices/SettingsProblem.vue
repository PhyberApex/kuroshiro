<script setup lang="ts">
import Icon from '@/components/Icon.vue'

defineProps<{
  /** Stands inside a row's note, which is a paragraph already. */
  inline?: boolean
}>()

defineSlots<{
  /** One sentence: why something in the section cannot be done on this Device. */
  default: () => unknown
}>()
</script>

<template>
  <component :is="inline ? 'span' : 'p'" class="settings-problem" :class="{ inline }">
    <Icon name="problem" class="mark" />
    <span><slot /></span>
  </component>
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
    color: var(--color-ink);
  }

  .settings-problem.inline {
    margin-top: 0;
  }

  .mark {
    flex: none;
    margin-top: 0.25em;
  }
}
</style>
