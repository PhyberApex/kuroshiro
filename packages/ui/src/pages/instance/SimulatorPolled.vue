<script setup lang="ts">
import type { DeviceModelReference } from 'kuroshiro-shared'
import type { SimulatorOutcome } from './deviceSimulator'
import { computed, ref } from 'vue'
import { deviceImageUrl } from '@/api/client'
import CodeBlock from '@/components/CodeBlock.vue'
import Notice from '@/components/Notice.vue'
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
const UNREAD = 'The server answered the poll, but the Device could not be read again to say what it shows.'

const shows = computed(() => 'shows' in props.outcome ? props.outcome.shows : undefined)
</script>

<template>
  <Notice
    v-if="'unread' in outcome"
    :title="UNREAD"
    :reason="outcome.unread"
  />
  <Plate
    class="given"
    :src="deviceImageUrl(outcome.answer.image_url)"
    :name="shows === undefined ? 'The image this poll was given' : `The image this poll was given: ${shows}`"
    :width="panel?.width"
    :height="panel?.height"
  />
  <SummaryList>
    <SummaryRow v-if="shows !== undefined" label="Shows">
      {{ shows }}
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
