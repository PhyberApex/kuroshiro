<script setup lang="ts">
import { useId } from 'vue'

defineProps<{
  /** What the address names the section by: `/instance/settings#retention`. */
  id?: string
  title: string
}>()

defineSlots<{
  default: () => unknown
  /** What stands at the right of the heading: a link, a button or a fact such as "Checked TRMNL 4 min ago". */
  aside?: () => unknown
}>()

const headingId = useId()
</script>

<template>
  <section :id="id" class="instance-section" :aria-labelledby="headingId">
    <header class="head">
      <h3 :id="headingId" class="heading">
        {{ title }}
      </h3>
      <div v-if="$slots.aside" class="aside">
        <slot name="aside" />
      </div>
    </header>
    <slot />
  </section>
</template>

<style scoped>
@layer components {
  .instance-section {
    margin-top: var(--space-10);
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
    padding-bottom: var(--space-2);
    border-bottom: var(--rule);
  }

  .heading {
    font-size: var(--text-lg);
    font-weight: var(--weight-semibold);
  }

  .aside {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
}
</style>
