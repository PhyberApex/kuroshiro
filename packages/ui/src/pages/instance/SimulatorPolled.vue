<script setup lang="ts">
import type { DeviceModelReference } from 'kuroshiro-shared'
import type { SimulatorOutcome } from './deviceSimulator'
import { computed, ref } from 'vue'
import CodeBlock from '@/components/CodeBlock.vue'
import Plate from '@/components/Plate.vue'
import SummaryList from '@/components/SummaryList.vue'
import SummaryRow from '@/components/SummaryRow.vue'
import TuckedSection from '@/components/TuckedSection.vue'
import { answerRows } from './simulatorWording'

const props = defineProps<{
  outcome: Extract<SimulatorOutcome, { kind: 'polled' }>
  panel?: DeviceModelReference
}>()

const rows = computed(() => answerRows(props.outcome.answer, props.outcome.firmwareVersion))
const asSent = computed(() => JSON.stringify(props.outcome.answer, null, 2))
const rawOpen = ref(true)
</script>

<template>
  <Plate
    class="given"
    :src="outcome.answer.image_url"
    :name="`The image this poll was given: ${outcome.shows}`"
    :width="panel?.width"
    :height="panel?.height"
  />
  <SummaryList>
    <SummaryRow label="Shows">
      {{ outcome.shows }}
    </SummaryRow>
    <SummaryRow v-for="row in rows" :key="row.label" :label="row.label">
      {{ row.value }}
    </SummaryRow>
  </SummaryList>
  <TuckedSection v-model:open="rawOpen" title="The answer as the Device gets it" heading="h3">
    <CodeBlock class="raw" :code="asSent" copy />
  </TuckedSection>
</template>

<style scoped>
@layer components {
  .given {
    max-width: var(--plate-hero);
  }
}
</style>
