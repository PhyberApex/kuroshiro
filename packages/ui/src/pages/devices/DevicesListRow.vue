<script setup lang="ts">
import type { AlertSummary, DeviceSummary } from 'kuroshiro-shared'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { imageUrl } from '@/api/client'
import Plate from '@/components/Plate.vue'
import RelativeTime from '@/patterns/RelativeTime.vue'
import { useNow } from '@/patterns/useNow'
import { currentScreenStory } from './currentScreenStory'
import { devicePath } from './devicePaths'
import { rowFacts, whatItShows } from './devicesListRow'
import SentenceLine from './SentenceLine.vue'

const props = defineProps<{
  device: DeviceSummary
  /** The Alerts firing on this Device. */
  alerts: AlertSummary[]
}>()

const now = useNow()
const story = computed(() => currentScreenStory({ device: props.device, screens: [], alerts: props.alerts, now: now.value }))
const shows = computed(() => whatItShows(story.value))
const facts = computed(() => rowFacts(props))
</script>

<template>
  <li class="device-row">
    <Plate
      size="list"
      :name="`On ${device.name}: ${story.heading}`"
      :src="imageUrl(device.currentScreen.imagePath)"
      :width="device.deviceModel?.width"
      :height="device.deviceModel?.height"
      lazy
    />
    <div class="said">
      <h2 class="name">
        <RouterLink class="open" :to="devicePath(device.id)">
          {{ device.name }}
        </RouterLink>
      </h2>
      <SentenceLine class="shows" :sentence="shows" />
      <p class="facts">
        <template v-for="(fact, index) in facts" :key="index">
          <template v-if="index > 0">
            ·
          </template>
          <span v-if="fact.kind === 'alert'" class="alert"><span class="square" aria-hidden="true" />{{ fact.text }}</span>
          <span v-else-if="fact.kind === 'lastSeen'" class="seen">Last seen <RelativeTime :at="fact.at" /></span>
          <span v-else>{{ fact.text }}</span>
        </template>
      </p>
    </div>
    <svg class="leads-on" viewBox="0 0 16 16" focusable="false" aria-hidden="true">
      <path d="M5.4 3.2 10.2 8l-4.8 4.8 1.1 1.1L12.4 8 6.5 2.1z" />
    </svg>
  </li>
</template>

<style scoped>
@layer components {
  .device-row {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) var(--icon);
    align-items: center;
    gap: var(--space-5);
    padding: var(--space-3) 0;
    border-bottom: var(--rule);
  }

  .name {
    font-stretch: var(--width-title);
    font-weight: var(--weight-title);
    font-size: var(--title-md);
    line-height: var(--leading-title);
    overflow-wrap: anywhere;
  }

  /* The whole row opens the Device: the name is the link and its hit area is the row. */
  .open {
    text-decoration: none;
  }

  .open::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  .open:hover {
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 4px;
  }

  .device-row .shows {
    margin-top: var(--space-1);
    color: var(--color-ink);
  }

  .facts {
    margin-top: var(--space-1);
    color: var(--color-ink-soft);
  }

  /* The seal colour is rationed: of a row's facts, only a firing Alert wears it. */
  .alert {
    color: var(--color-seal);
    font-weight: var(--weight-medium);
  }

  .square {
    display: inline-block;
    width: var(--space-2);
    height: var(--space-2);
    margin-right: var(--space-2);
    background: var(--color-seal);
  }

  /* Above the row's link, so that the exact time shows on hover. */
  .seen {
    position: relative;
  }

  .leads-on {
    width: var(--icon);
    height: var(--icon);
    fill: var(--color-ink-soft);
  }

  @media (max-width: 820px) {
    .device-row {
      grid-template-columns: auto minmax(0, 1fr);
      gap: var(--space-3);
    }

    .leads-on {
      display: none;
    }
  }
}
</style>
