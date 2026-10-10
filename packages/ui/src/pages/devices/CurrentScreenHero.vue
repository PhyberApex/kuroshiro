<script setup lang="ts">
import type { AlertSummary, DeviceDetail, ScreenRead } from 'kuroshiro-shared'
import { computed } from 'vue'
import { imageUrl } from '@/api/client'
import FactRows from '@/components/FactRows.vue'
import Plate from '@/components/Plate.vue'
import RelativeTime from '@/patterns/RelativeTime.vue'
import { useNow } from '@/patterns/useNow'
import { currentScreenStory } from './currentScreenStory'
import { deviceFacts } from './deviceFacts'
import HeroColumns from './HeroColumns.vue'
import SentenceLine from './SentenceLine.vue'

const props = defineProps<{
  device: DeviceDetail
  /** The Device's Screens in Order. */
  screens: ScreenRead[]
  /** The Alerts firing on this Device. */
  alerts: AlertSummary[]
}>()

const now = useNow()
const told = computed(() => ({ device: props.device, screens: props.screens, alerts: props.alerts, now: now.value }))
const story = computed(() => currentScreenStory(told.value))
const facts = computed(() => deviceFacts(told.value))
</script>

<template>
  <HeroColumns role="region" aria-label="Current Screen">
    <template #plate>
      <Plate
        size="current"
        :name="`On ${device.name}: ${story.heading}`"
        :src="device.currentScreen.imagePath && imageUrl(device.currentScreen.imagePath)"
        :width="device.deviceModel?.width"
        :height="device.deviceModel?.height"
        :sealed="story.sealed"
        :stamp-key="story.stampKey"
      />
    </template>
    <h2 class="heading">
      {{ story.heading }}
    </h2>
    <SentenceLine v-for="(sentence, index) in story.sentences" :key="index" class="sentence" :sentence="sentence" />
    <FactRows class="facts" :facts="facts">
      <template #value="{ fact }">
        <template v-if="fact.at">
          {{ fact.lead }}<RelativeTime :at="fact.at" />
        </template>
        <template v-else>
          {{ fact.value }}
        </template>
      </template>
    </FactRows>
  </HeroColumns>
</template>

<style scoped>
@layer components {
  .heading {
    font-stretch: var(--width-title);
    font-weight: var(--weight-title);
    font-size: var(--title-md);
    line-height: var(--leading-title);
    text-wrap: balance;
    overflow-wrap: anywhere;
  }

  .sentence {
    margin-top: var(--space-2);
  }

  .facts {
    margin-top: var(--space-5);
  }
}
</style>
