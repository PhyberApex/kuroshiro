<script setup lang="ts">
import type { AlertsList, InstanceFacts, InstanceSettingsResponse } from 'kuroshiro-shared'
import type { AlertTold } from './alertWording'
import type { Load } from '@/patterns/useLoad'
import { computed, reactive } from 'vue'
import { getInstanceSettings } from '@/api/instance'
import Icon from '@/components/Icon.vue'
import LoadBody from '@/patterns/LoadBody.vue'
import TitleLine from '@/patterns/TitleLine.vue'
import { useLoad } from '@/patterns/useLoad'
import { useNow } from '@/patterns/useNow'
import WashBar from '@/patterns/WashBar.vue'
import { useAlerts, useInstanceFacts } from '@/reads/sharedReads'
import AlertRow from './AlertRow.vue'
import AlertsWatched from './AlertsWatched.vue'
import ResolvedAlerts from './ResolvedAlerts.vue'

const alerts = useAlerts()
const settings = useLoad(getInstanceSettings, { fresh: true })
const instanceFacts = useInstanceFacts()
const now = useNow()

interface AlertsPageData {
  alerts: AlertsList
  settings: InstanceSettingsResponse
  facts: InstanceFacts
}

/** The page words the Alerts with the thresholds and says whether they are announced, so it waits for all three and any one's failure is its notice. */
const page: Load<AlertsPageData> = reactive({
  data: computed(() => alerts.data && settings.data && instanceFacts.data
    ? { alerts: alerts.data, settings: settings.data, facts: instanceFacts.data }
    : undefined),
  waiting: computed(() => alerts.waiting || settings.waiting || instanceFacts.waiting),
  failure: computed(() => alerts.failure ?? settings.failure ?? instanceFacts.failure),
  missing: false,
  reload: async () => {
    await Promise.all([alerts.reload(), settings.reload(), instanceFacts.reload()])
  },
})

const told = computed((): AlertTold | undefined => settings.data && { now: now.value, lowBatteryPercent: settings.data.lowBatteryPercent.value })

/** The widths of the three bars of each loading row: where the Alert, its subject and why will be. */
const LOADING_ROWS = [
  { kind: '70%', subject: '60%', why: '70%' },
  { kind: '70%', subject: '54%', why: '64%' },
]
</script>

<template>
  <TitleLine title="Alerts" />
  <LoadBody :load="page" loading="Loading Alerts" failed="Could not load the Alerts.">
    <template #default="{ data }">
      <template v-if="told">
        <ul v-if="data.alerts.active.length > 0" class="firing-alerts" aria-label="Firing Alerts">
          <AlertRow v-for="alert in data.alerts.active" :key="alert.id" :alert="alert" :told="told" />
        </ul>
        <p v-else class="none-firing">
          <Icon name="check" />
          No Alert is firing.
        </p>
        <AlertsWatched :settings="data.settings" :notifications-set-up="data.facts.notifications.configured" />
        <ResolvedAlerts :alerts="data.alerts.resolved" :told="told" />
      </template>
    </template>
    <template #skeleton>
      <div class="firing-alerts" aria-hidden="true">
        <div v-for="(widths, index) in LOADING_ROWS" :key="index" class="loading-row">
          <WashBar :width="widths.kind" />
          <WashBar :width="widths.subject" />
          <WashBar :width="widths.why" />
        </div>
      </div>
    </template>
  </LoadBody>
</template>

<style scoped>
@layer components {
  .firing-alerts {
    border-top: var(--rule-heavy);
  }

  .none-firing {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4) 0;
    border-top: var(--rule-heavy);
    border-bottom: var(--rule);
    font-weight: var(--weight-semibold);
  }

  .loading-row {
    display: grid;
    grid-template-columns: 11.5rem minmax(0, 14rem) minmax(0, 1fr);
    align-items: center;
    gap: var(--space-4);
    min-height: 3.25rem;
    border-bottom: var(--rule);
  }

  @media (max-width: 820px) {
    .loading-row {
      grid-template-columns: minmax(0, 1fr);
      align-content: center;
      gap: var(--space-3);
      padding: var(--space-4) 0;
    }
  }
}
</style>
