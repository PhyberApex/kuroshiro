<script setup lang="ts">
import type { NavItem } from '@/components/navItem'
import { watchEffect } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps<{
  /** The page's title, which is also the browser tab's: "Kitchen" reads "Kitchen · Kuroshiro". */
  title: string
  /** The link back that a page below a list carries above its title: `{ label: 'All Plugins', to: '/plugins' }`. It needs a router. */
  back?: NavItem
}>()

defineSlots<{
  /** The page's actions, at the right of the title: buttons, the primary one last. */
  actions?: () => unknown
}>()

watchEffect(() => {
  document.title = `${props.title} · Kuroshiro`
})
</script>

<template>
  <header class="title-line">
    <RouterLink v-if="back" class="back" :to="back.to">
      <svg class="back-mark" viewBox="0 0 16 16" focusable="false" aria-hidden="true">
        <path d="M10.6 3.2 5.8 8l4.8 4.8-1.1 1.1L3.6 8l5.9-5.9z" />
      </svg>
      {{ back.label }}
    </RouterLink>
    <div class="line">
      <h1 class="title">
        {{ title }}
      </h1>
      <div v-if="$slots.actions" class="actions">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>

<style scoped>
@layer components {
  .title-line {
    margin-bottom: var(--space-6);
  }

  .back {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    margin-bottom: var(--space-3);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    text-underline-offset: 3px;
    transition: color var(--duration-quick) var(--ease-out);
  }

  .back:hover,
  .back[data-force~='hover'] {
    color: var(--color-ink);
  }

  .back-mark {
    flex: none;
    width: var(--icon);
    height: var(--icon);
    fill: currentColor;
  }

  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4) var(--space-6);
  }

  .title {
    min-width: 0;
    font-stretch: var(--width-title-lg);
    font-weight: var(--weight-title-lg);
    font-size: var(--title-lg);
    line-height: var(--leading-title-lg);
    letter-spacing: var(--tracking-title-lg);
    text-wrap: balance;
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
}
</style>
