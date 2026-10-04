<script setup lang="ts">
defineProps<{
  /** What is not there: "No Screens yet". */
  title: string
  /** The whole-page size, for a record that does not exist. */
  page?: boolean
  /** The heading the title is, by where the empty state sits in the page's outline. Left out, it is the `h1` of a whole page and an `h2` anywhere else. */
  heading?: 'h1' | 'h2' | 'h3' | 'h4'
}>()

defineSlots<{
  /** One sentence: what would be here and how it gets here. */
  default?: () => unknown
  /** The one thing to do next: a button, or the link back. */
  action?: () => unknown
}>()
</script>

<template>
  <div class="empty-state" :class="{ page }">
    <component :is="heading ?? (page ? 'h1' : 'h2')" class="title">
      {{ title }}
    </component>
    <p v-if="$slots.default" class="sentence">
      <slot />
    </p>
    <div v-if="$slots.action" class="action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
@layer components {
  .empty-state {
    max-width: var(--measure);
    padding-top: var(--space-4);
    border-top: var(--rule-heavy);
  }

  .title {
    font-stretch: var(--width-title);
    font-weight: var(--weight-title);
    font-size: var(--title-sm);
    line-height: var(--leading-title);
    text-wrap: balance;
  }

  .sentence {
    margin-top: var(--space-2);
    color: var(--color-ink-soft);
  }

  .action {
    margin-top: var(--space-4);
  }

  .page {
    padding-block: var(--space-8) var(--space-16);
  }

  .page .title {
    font-size: var(--title-md);
  }

  .page .sentence {
    margin-top: var(--space-3);
    font-size: var(--text-lg);
  }

  .page .action {
    margin-top: var(--space-6);
  }
}
</style>
