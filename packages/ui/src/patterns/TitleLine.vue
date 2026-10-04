<script setup lang="ts">
import type { NavItem } from '@/components/navItem'
import BackLink from './BackLink.vue'
import { usePageTitle } from './usePageTitle'

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

usePageTitle(() => props.title)
</script>

<template>
  <header class="title-line">
    <BackLink v-if="back" class="back" :to="back.to">
      {{ back.label }}
    </BackLink>
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
    margin-bottom: var(--space-3);
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
