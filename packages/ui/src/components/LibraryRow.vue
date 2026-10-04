<script setup lang="ts">
import Icon from './Icon.vue'

defineProps<{
  /** What the row is called: a Firmware's version, a Device Model's label, a Palette's name. */
  name: string
  /** Sets the name in mono: a version, not words. */
  mono?: boolean
  /** What is wrong with it and what to do about it, under what it is. */
  problem?: string
}>()

defineSlots<{
  /** What it is, in one line or several. */
  default?: () => unknown
  /** At the right: its date, who uses it, its actions. */
  end?: () => unknown
  /** A form that is open under the row, such as the one that edits it. */
  form?: () => unknown
}>()
</script>

<template>
  <li class="library-row">
    <div class="cells">
      <b class="name" :class="{ mono }">{{ name }}</b>
      <div class="what">
        <slot />
        <p v-if="problem" class="problem">
          <Icon name="problem" class="mark" />
          <span>{{ problem }}</span>
        </p>
      </div>
      <div v-if="$slots.end" class="end">
        <slot name="end" />
      </div>
    </div>
    <div v-if="$slots.form" class="open-form">
      <slot name="form" />
    </div>
  </li>
</template>

<style scoped>
@layer components {
  .library-row {
    border-bottom: var(--rule);
  }

  .cells {
    display: grid;
    grid-template-columns: minmax(0, var(--library-name-width, 9.5rem)) minmax(0, 1fr) auto;
    grid-template-areas: "name what end";
    align-items: center;
    gap: var(--space-1) var(--space-4);
    min-height: 3.25rem;
    padding: var(--space-2) 0;
  }

  .name {
    grid-area: name;
    min-width: 0;
    font-weight: var(--weight-semibold);
    overflow-wrap: anywhere;
  }

  .name.mono {
    font-family: var(--font-mono);
    font-size: var(--text-md);
  }

  .what {
    grid-area: what;
    min-width: 0;
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }

  /* Trouble is ink, never the seal colour: the problem icon tells it. */
  .problem {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    color: var(--color-ink);
  }

  .library-row .mark {
    flex: none;
    margin-top: calc((1lh - var(--icon)) / 2);
  }

  .end {
    grid-area: end;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-3);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    white-space: nowrap;
  }

  .open-form {
    padding: var(--space-4) 0 var(--space-5);
    border-top: var(--rule);
  }

  @media (max-width: 820px) {
    .cells {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas:
        "name end"
        "what what";
    }
  }
}
</style>
