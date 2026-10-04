<script setup lang="ts">
import Icon from './Icon.vue'

defineProps<{
  label: string
  /** Lines that each say something to mind, drawn with the problem icon. They stand under the default slot. */
  problems?: string[]
}>()

defineSlots<{
  /** The value: a sentence, or a value over the sentence that explains it. */
  default?: () => unknown
}>()
</script>

<template>
  <div class="summary-row">
    <dt class="label">
      {{ label }}
    </dt>
    <dd class="value">
      <slot />
      <ul v-if="problems?.length" class="problems">
        <li v-for="problem in problems" :key="problem" class="problem">
          <Icon name="problem" class="mark" />
          <span>{{ problem }}</span>
        </li>
      </ul>
    </dd>
  </div>
</template>

<style scoped>
@layer components {
  .summary-row {
    display: grid;
    grid-template-columns: 9rem minmax(0, 1fr);
    gap: var(--space-1) var(--space-4);
    padding: var(--space-3) 0;
    border-bottom: var(--rule);
  }

  .label {
    color: var(--color-ink-soft);
  }

  .value {
    max-width: var(--measure);
    overflow-wrap: anywhere;
  }

  .problems {
    display: grid;
    gap: var(--space-1);
  }

  .problem {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .summary-row .mark {
    flex: none;
    margin-top: calc((1lh - var(--icon)) / 2);
  }

  @media (max-width: 820px) {
    .summary-row {
      grid-template-columns: minmax(0, 1fr);
    }
  }
}
</style>
