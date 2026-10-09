<script setup lang="ts">
import type { NavItem } from './navItem'
import { useTemplateRef, watch, watchEffect } from 'vue'
import { RouterLink } from 'vue-router'
import { useCurrentNavItem } from './navItem'

const props = defineProps<{
  /** What the pages belong to, such as "Instance". It names the navigation. */
  label: string
  items: NavItem[]
  /** For the gallery: the states held still on a page, by its label, such as `{ Firmware: 'hover' }`. */
  force?: Record<string, string>
}>()

const current = useCurrentNavItem(() => props.items)
const scroller = useTemplateRef('scroller')
const pages = useTemplateRef('pages')

/* Below 820 px the list is a row that scrolls sideways. It is scrolled by hand, because `scrollIntoView` would move the page too. */
function revealCurrent() {
  const currentLink = scroller.value?.querySelector('[aria-current="page"]')
  if (!scroller.value || !currentLink)
    return
  const frame = scroller.value.getBoundingClientRect()
  const link = currentLink.getBoundingClientRect()
  scroller.value.scrollLeft += Math.min(0, link.left - frame.left) + Math.max(0, link.right - frame.right)
}

watch(current, revealCurrent, { flush: 'post' })

// Observing also covers the first layout, a window that is narrowed into the row and links that change width when the face loads.
watchEffect((onCleanup) => {
  if (!scroller.value || !pages.value)
    return
  const observer = new ResizeObserver(revealCurrent)
  observer.observe(scroller.value)
  observer.observe(pages.value)
  onCleanup(() => observer.disconnect())
})
</script>

<template>
  <nav ref="scroller" class="page-list" :aria-label="label">
    <ul ref="pages" class="pages">
      <li v-for="(item, index) in items" :key="item.label">
        <RouterLink
          class="page"
          :to="item.to"
          :aria-current="index === current ? 'page' : undefined"
          :data-force="force?.[item.label]"
        >
          {{ item.label }}
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
@layer components {
  .pages {
    display: grid;
    gap: 2px;
    margin-left: calc(var(--space-2) * -1);
  }

  .page {
    display: flex;
    align-items: center;
    min-height: var(--control-height);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius);
    font-weight: var(--weight-medium);
    text-decoration: none;
    transition:
      background-color var(--duration-quick) var(--ease-out),
      color var(--duration-quick) var(--ease-out);
  }

  /* `data-force` holds a state still for the gallery, where no pointer is over the page. */
  .page:is(:hover, [data-force~='hover']) {
    background: var(--color-wash);
  }

  .page[aria-current='page'] {
    background: var(--color-ink);
    color: var(--color-paper);
    font-weight: var(--weight-semibold);
  }

  @media (max-width: 820px) {
    .page-list {
      border-bottom: var(--rule);
      overflow-x: auto;
      scrollbar-width: none;
    }

    /* As wide as its links, so the observer sees them widen. */
    .pages {
      display: flex;
      width: max-content;
      gap: var(--space-5);
      margin-left: 0;
    }

    .page {
      min-height: var(--hit-target);
      padding: 0;
      border-radius: 0;
      color: var(--color-ink-soft);
      white-space: nowrap;
    }

    .page:is(:hover, [data-force~='hover']) {
      background: none;
      color: var(--color-ink);
    }

    .page[aria-current='page'] {
      background: none;
      box-shadow: inset 0 -2px 0 var(--color-ink);
      color: var(--color-ink);
    }

    /* The row scrolls sideways, which would cut a ring drawn outside the link. */
    .page-list .page:is(:focus-visible, [data-force~='focus']) {
      outline-offset: -2px;
    }
  }
}
</style>
