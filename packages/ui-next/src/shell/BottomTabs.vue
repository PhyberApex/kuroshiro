<script setup lang="ts">
import type { BarEntry, NamedDevice } from './barEntries'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { DEVICES_ENTRY, DEVICES_PATH, firstTabLabel, indexOfCurrentEntry, SECTION_ENTRIES } from './barEntries'

const props = defineProps<{
  /** Every Device, in the order they are listed in. */
  devices: NamedDevice[]
}>()

const route = useRoute()

const amongDevices = computed(() => indexOfCurrentEntry([DEVICES_ENTRY], route.path) === 0)

/*
The first tab opens the landing route. Tapped while already among the Devices it opens the
Devices list, which is how "Connect a Device" is reached with a single Device.
*/
const firstTab = computed<BarEntry>(() => ({ label: firstTabLabel(props.devices), to: amongDevices.value ? DEVICES_PATH : '/' }))
const tabs = computed(() => [firstTab.value, ...SECTION_ENTRIES])
const currentSection = computed(() => indexOfCurrentEntry(SECTION_ENTRIES, route.path))
const current = computed(() => amongDevices.value ? 0 : currentSection.value === -1 ? -1 : currentSection.value + 1)
</script>

<template>
  <nav class="bottom-tabs" aria-label="Main">
    <RouterLink
      v-for="(tab, index) in tabs"
      :key="index"
      class="tab"
      :to="tab.to"
      :aria-current="index === current ? 'page' : undefined"
    >
      <span class="name">{{ tab.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
@layer components {
  .bottom-tabs {
    display: none;
  }

  @media (max-width: 820px) {
    .bottom-tabs {
      display: grid;
      grid-auto-columns: minmax(0, 1fr);
      grid-auto-flow: column;
      height: calc(var(--bar-height) + env(safe-area-inset-bottom));
      padding-bottom: env(safe-area-inset-bottom);
      border-top: var(--rule);
      background: var(--color-paper);
    }
  }

  .tab {
    display: grid;
    place-items: center;
    min-width: 0;
    /* The current tab's line sits on the tabs' top rule. */
    margin-top: -1px;
    padding-inline: var(--space-2);
    border-top: 2px solid transparent;
    color: var(--color-ink-soft);
    font-weight: var(--weight-medium);
    text-decoration: none;
  }

  .tab[aria-current] {
    border-top-color: var(--color-ink);
    color: var(--color-ink);
    font-weight: var(--weight-title);
  }

  .tab:focus-visible,
  .tab[data-force~='focus'] {
    outline-offset: -2px;
  }

  .name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
