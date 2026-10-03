<script setup lang="ts">
import type { NamedDevice } from './barEntries'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import Seal from '@/components/Seal.vue'
import { DEVICES_ENTRY, indexOfCurrentEntry, MOST_DEVICES_NAMED, namedDeviceEntries, SECTION_ENTRIES } from './barEntries'
import BarLink from './BarLink.vue'

const props = withDefaults(defineProps<{
  /** Every Device, in the order they are listed in. */
  devices: NamedDevice[]
  /** How many Alerts fire. The indicator shows only while one does. */
  firingAlerts?: number
  /** For the gallery: the label of a cut name whose tooltip is held open. */
  tooltipOpenOn?: string
}>(), {
  firingAlerts: 0,
})

const route = useRoute()

const namedEntries = computed(() => namedDeviceEntries(props.devices))

/*
The bar never wraps and never scrolls. Whether the names fit is read off a copy of the full
row that is laid out but never shown, so the answer does not depend on what the bar shows now.
*/
const sections = useTemplateRef('sections')
const fullRow = useTemplateRef('fullRow')
const roomForNames = ref(true)

function measureRoom() {
  if (sections.value && fullRow.value)
    roomForNames.value = fullRow.value.offsetWidth <= sections.value.clientWidth
}

const widths = new ResizeObserver(measureRoom)

onMounted(() => {
  widths.observe(sections.value!)
  widths.observe(fullRow.value!)
  measureRoom()
})
onBeforeUnmount(() => widths.disconnect())

const namesDevices = computed(() => props.devices.length <= MOST_DEVICES_NAMED && roomForNames.value)
const deviceEntries = computed(() => namesDevices.value ? namedEntries.value : [DEVICES_ENTRY])
const entries = computed(() => [...deviceEntries.value, ...SECTION_ENTRIES])
const current = computed(() => indexOfCurrentEntry(entries.value, route.path))

const alertsFiring = computed(() => `${props.firingAlerts} ${props.firingAlerts === 1 ? 'Alert' : 'Alerts'} firing`)
</script>

<template>
  <header class="bar" data-shell-bar>
    <RouterLink class="lockup" to="/">
      <Seal :size="28" colour="ink" />
      <span class="wordmark">Kuroshiro</span>
    </RouterLink>

    <nav ref="sections" class="sections" aria-label="Main">
      <template v-for="(entry, index) in entries" :key="entry.to">
        <span v-if="index === deviceEntries.length" class="divider" aria-hidden="true" />
        <BarLink :entry="entry" :current="index === current" :tooltip-open="tooltipOpenOn === entry.label" />
      </template>

      <div class="unseen" aria-hidden="true">
        <div ref="fullRow" class="full-row">
          <span v-for="entry in namedEntries" :key="entry.to" class="stand-in">{{ entry.label }}</span>
          <span class="divider" />
          <span v-for="entry in SECTION_ENTRIES" :key="entry.to" class="stand-in">{{ entry.label }}</span>
        </div>
      </div>
    </nav>

    <RouterLink
      v-if="firingAlerts > 0"
      class="alert-indicator"
      to="/alerts"
      :aria-current="route.path === '/alerts' ? 'page' : undefined"
    >
      {{ alertsFiring }}
    </RouterLink>
  </header>
</template>

<style scoped>
@layer components {
  .bar {
    display: flex;
    align-items: stretch;
    gap: var(--space-6);
    height: var(--bar-height);
    padding-inline: var(--gutter);
    border-bottom: var(--rule);
    background: var(--color-paper);
  }

  .lockup {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: var(--space-3);
    text-decoration: none;
  }

  .wordmark {
    font-stretch: var(--width-title-lg);
    font-weight: var(--weight-title-lg);
    font-size: var(--title-sm);
    line-height: 1;
    letter-spacing: var(--tracking-title-lg);
  }

  .sections {
    position: relative;
    display: flex;
    flex: 1;
    align-items: stretch;
    gap: var(--space-5);
    min-width: 0;
  }

  .divider {
    flex: none;
    width: 1px;
    margin-block: var(--space-4);
    background: var(--color-line);
  }

  .unseen {
    position: absolute;
    width: 0;
    height: 0;
    overflow: hidden;
    visibility: hidden;
  }

  .full-row {
    display: flex;
    gap: var(--space-5);
    width: max-content;
  }

  /* As wide as an entry at its widest, which is the weight of the current one. */
  .stand-in {
    font-weight: var(--weight-semibold);
    white-space: nowrap;
  }

  /* An Alert is red where it is told, on its Device or Plugin. The shell only counts, in ink. */
  .alert-indicator {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: -1px;
    margin-left: auto;
    border-bottom: 2px solid transparent;
    font-weight: var(--weight-semibold);
    text-decoration: none;
    white-space: nowrap;
  }

  .alert-indicator::before {
    content: '';
    flex: none;
    width: var(--space-2);
    height: var(--space-2);
    background: var(--color-ink);
  }

  .alert-indicator:hover,
  .alert-indicator[data-force~='hover'] {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .alert-indicator[aria-current] {
    border-bottom-color: var(--color-ink);
  }

  .lockup:focus-visible,
  .alert-indicator:focus-visible {
    outline-offset: -2px;
  }

  @media (max-width: 820px) {
    .sections {
      display: none;
    }
  }
}
</style>
