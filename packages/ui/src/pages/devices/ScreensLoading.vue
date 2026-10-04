<script setup lang="ts">
import type { DeviceModelReference } from 'kuroshiro-shared'
import Plate from '@/components/Plate.vue'
import LoadingLine from '@/patterns/LoadingLine.vue'
import WashBar from '@/patterns/WashBar.vue'
import HeroColumns from './HeroColumns.vue'
import { possessive } from './screenNaming'

defineProps<{
  deviceName: string
  /** Whether the answer has taken long enough for the loading state to show. */
  waiting: boolean
  /** The Device Model, where the Devices list already knows it: the shape of the plates. */
  deviceModel?: DeviceModelReference | null
}>()

const FACT_WIDTHS = ['60%', '40%', '52%', '46%']
const ROW_WIDTHS = ['38%', '30%', '44%']
</script>

<template>
  <HeroColumns class="screens-loading">
    <template #plate>
      <Plate
        v-if="waiting"
        size="current"
        :name="`On ${deviceName}`"
        :width="deviceModel?.width"
        :height="deviceModel?.height"
        rendering
      />
      <span v-else />
    </template>
    <LoadingLine :shown="waiting">
      Loading {{ possessive(deviceName) }} Screens
    </LoadingLine>
    <div v-if="waiting" class="facts" aria-hidden="true">
      <div v-for="width in FACT_WIDTHS" :key="width" class="fact">
        <WashBar :width="width" />
      </div>
    </div>
  </HeroColumns>
  <div v-if="waiting" class="rows" aria-hidden="true">
    <p class="heading">
      Screens in Order
    </p>
    <div v-for="width in ROW_WIDTHS" :key="width" class="row">
      <Plate size="row" name="A Screen" :width="deviceModel?.width" :height="deviceModel?.height" rendering />
      <WashBar :width="width" />
    </div>
  </div>
</template>

<style scoped>
@layer components {
  .facts {
    margin-top: var(--space-5);
    border-top: var(--rule-heavy);
  }

  .fact {
    padding: var(--space-3) 0;
    border-bottom: var(--rule);
  }

  .rows {
    margin-top: var(--space-10);
  }

  .heading {
    padding-bottom: var(--space-2);
    border-bottom: var(--rule-heavy);
    font-stretch: var(--width-title);
    font-weight: var(--weight-title);
    font-size: var(--title-sm);
    line-height: var(--leading-title);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--hit-target);
    padding: var(--space-2) 0 var(--space-2) calc(1rem + 1.25rem + 2 * var(--space-3));
    border-bottom: var(--rule);
  }

  @media (max-width: 820px) {
    .row {
      padding-left: 0;
    }
  }
}
</style>
