<script setup lang="ts">
import type { RetentionRunResult, RetentionStatus } from 'kuroshiro-shared'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { runRetention } from '@/api/maintenance'
import Button from '@/components/Button.vue'
import Confirmation from '@/components/Confirmation.vue'
import { failureReason } from '@/components/failureReason'
import Notice from '@/components/Notice.vue'
import ResultLine from '@/components/ResultLine.vue'
import RelativeTime from '@/patterns/RelativeTime.vue'
import { nothingOldEnough, prunedCounts, retentionIsOff, retentionLost, retentionSentence } from './housekeepingWording'
import { RETENTION_PATH } from './instancePaths'
import InstanceSection from './InstanceSection.vue'

const props = defineProps<{
  status: RetentionStatus
}>()

const emit = defineEmits<{
  /** A Retention Run finished, so the last run is another one. */
  ran: []
}>()

type Step
  = | { step: 'idle' }
    | { step: 'counting' }
    | { step: 'nothingOldEnough' }
    | { step: 'finished', result: RetentionRunResult }
    | { step: 'failed', reason: string }

const state = ref<Step>({ step: 'idle' })
const counted = ref<RetentionRunResult>({ alertsPruned: 0, deviceLogsPruned: 0 })
const asking = ref(false)

/** A run asks the server what it would remove first, and confirms only when that is something. */
async function count() {
  state.value = { step: 'counting' }
  try {
    const wouldRemove = await runRetention({ dryRun: true })
    state.value = { step: nothingOldEnough(wouldRemove) ? 'nothingOldEnough' : 'idle' }
    counted.value = wouldRemove
    asking.value = !nothingOldEnough(wouldRemove)
  }
  catch (error) {
    state.value = { step: 'failed', reason: failureReason(error) ?? 'Something went wrong.' }
  }
}

async function run() {
  const result = await runRetention({ dryRun: false })
  state.value = { step: 'finished', result }
  emit('ran')
}

const said = computed(() => {
  switch (state.value.step) {
    case 'counting':
      return 'Counting what is old enough'
    case 'nothingOldEnough':
      return 'Nothing is old enough to remove.'
    case 'finished':
      return `Removed ${prunedCounts(state.value.result)}.`
    default:
      return undefined
  }
})
</script>

<template>
  <InstanceSection id="retention" title="Retention">
    <template #aside>
      <RouterLink class="link" :to="RETENTION_PATH">
        Change the ages
      </RouterLink>
    </template>
    <div class="retention">
      <p class="sentence">
        {{ retentionSentence(status.ages) }}
      </p>
      <p v-if="status.lastRun" class="last-run">
        Last Retention Run <RelativeTime :at="status.lastRun.ranAt" />: removed {{ prunedCounts(status.lastRun) }}.
      </p>
      <p v-else class="last-run">
        Retention has not run since Kuroshiro was started.
      </p>
      <Notice
        v-if="state.step === 'failed'"
        title="Could not run Retention."
        :reason="state.reason"
        action="Try again"
        @act="count"
      />
      <ResultLine :running="state.step === 'counting'">
        <template v-if="said" #default>
          <b v-if="state.step === 'finished'">Retention Run finished.</b>{{ ' ' }}{{ said }}
        </template>
      </ResultLine>
      <div class="run">
        <Button :disabled="retentionIsOff(props.status.ages)" :loading="state.step === 'counting'" @click="count">
          Run Retention now
        </Button>
      </div>
    </div>
    <Confirmation v-model:open="asking" title="Run Retention now?" confirm-label="Run Retention" :action="run">
      <template #lost>
        {{ retentionLost(status.ages, counted) }}
      </template>
      <template #stays>
        Firing Alerts, and everything newer than the ages.
      </template>
    </Confirmation>
  </InstanceSection>
</template>

<style scoped>
@layer components {
  .retention {
    margin-top: var(--space-4);
  }

  .retention > :not(:empty) ~ * {
    margin-top: var(--space-3);
  }

  .sentence,
  .last-run {
    max-width: var(--measure);
    text-wrap: pretty;
  }

  .last-run {
    color: var(--color-ink-soft);
  }

  .retention b {
    font-weight: var(--weight-semibold);
  }

  .retention .run {
    margin-top: var(--space-4);
  }

  .link {
    text-underline-offset: 3px;
    transition: color var(--duration-quick) var(--ease-out);
  }

  .link:hover {
    color: var(--color-ink-hover);
  }
}
</style>
