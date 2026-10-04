<script setup lang="ts">
import { computed } from 'vue'
import EmptyPlate from '@/components/EmptyPlate.vue'
import Notice from '@/components/Notice.vue'
import ResultLine from '@/components/ResultLine.vue'
import { useSimulator } from './deviceSimulator'
import SimulatorPolled from './SimulatorPolled.vue'

const simulator = useSimulator()

const panel = computed(() => simulator.listed?.deviceModel ?? undefined)
const outcome = computed(() => simulator.outcome)

const REFUSED = { poll: 'The server refused the poll.', setup: 'The server refused setup.' }
const UNANSWERED = { poll: 'The poll did not reach the server.', setup: 'Setup did not reach the server.' }
</script>

<template>
  <section class="answer" aria-label="What the server answered">
    <SimulatorPolled v-if="outcome.kind === 'polled'" :outcome="outcome" :panel="panel" />
    <Notice v-else-if="outcome.kind === 'refused'" :title="REFUSED[outcome.call]" :reason="outcome.reason" />
    <Notice v-else-if="outcome.kind === 'unanswered'" :title="UNANSWERED[outcome.call]" :reason="outcome.reason" />
    <template v-else>
      <EmptyPlate :width="panel?.width" :height="panel?.height">
        Nothing polled yet
      </EmptyPlate>
      <ResultLine>
        <template v-if="outcome.kind === 'registered'" #default>
          <b>Setup registered a Device.</b> It is called {{ outcome.friendlyId }} until you name it, and has its API key.
        </template>
        <template v-else-if="outcome.kind === 'known' && outcome.chosen" #default>
          Setup answered with {{ outcome.deviceName }}'s API key and friendly id. Nothing changed.
        </template>
        <template v-else-if="outcome.kind === 'known'" #default>
          This MAC address is {{ outcome.deviceName }}'s, so setup answered with its API key and friendly id.
        </template>
      </ResultLine>
    </template>
  </section>
</template>

<style scoped>
@layer components {
  .answer {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-4);
  }
}
</style>
