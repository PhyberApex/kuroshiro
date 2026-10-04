<script setup lang="ts">
import type { InstanceFacts, InstanceSettingsResponse } from 'kuroshiro-shared'
import { RouterLink } from 'vue-router'
import { getInstanceSettings } from '@/api/instance'
import { joinLoads } from '@/patterns/joinLoads'
import LoadBody from '@/patterns/LoadBody.vue'
import ReadRow from '@/patterns/ReadRow.vue'
import { useLoad } from '@/patterns/useLoad'
import WashBar from '@/patterns/WashBar.vue'
import { useInstanceFacts } from '@/reads/sharedReads'
import { ALERTS_PATH } from '@/shell/barEntries'
import InstancePageHeading from './InstancePageHeading.vue'
import { FIRMWARE_PATH, HOUSEKEEPING_PATH } from './instancePaths'
import InstanceSection from './InstanceSection.vue'
import InstanceSettingRow from './InstanceSettingRow.vue'
import { batteryLowNote, deviceLogEntriesNote, fetchFailureStreakNote, offlineNote, resolvedAlertsNote } from './instanceSettingWording'
import { useOnlyDevice } from './onlyDevice'
import TestNotificationRow from './TestNotificationRow.vue'

const settings = useLoad(getInstanceSettings)
const instanceFacts = useInstanceFacts()
const onlyDevice = useOnlyDevice()

/** The page shows the Settings and the Instance facts together, so it waits for both and either one's failure is its notice. */
const page = joinLoads<{ settings: InstanceSettingsResponse, facts: InstanceFacts }>({ settings, facts: instanceFacts })

const metricsUrl = (serverUrl: string) => `${serverUrl.replace(/\/+$/, '')}/metrics`

const SKELETON_ROW_WIDTHS = ['30%', '26%', '34%', '22%']
</script>

<template>
  <InstancePageHeading title="Instance Settings" />
  <div class="body">
    <LoadBody :load="page" loading="Loading the Instance Settings" failed="Could not load the Instance Settings.">
      <template #skeleton>
        <div class="skeleton" aria-hidden="true">
          <div v-for="width in SKELETON_ROW_WIDTHS" :key="width" class="skeleton-row">
            <WashBar width="60%" />
            <WashBar :width="width" />
          </div>
        </div>
      </template>
      <template #default="{ data }">
        <p class="lede">
          Values for this whole Instance. Changes save as you make them.
        </p>

        <InstanceSection id="alert-rules" class="first" title="Alert Rules">
          <template #aside>
            <RouterLink class="link" :to="ALERTS_PATH">
              Alerts
            </RouterLink>
          </template>
          <InstanceSettingRow setting-key="lowBatteryPercent" :setting="data.settings.lowBatteryPercent" label="Battery low" before="below" after="%">
            <template #note="{ value }">
              {{ batteryLowNote(value) }}
            </template>
          </InstanceSettingRow>
          <InstanceSettingRow setting-key="offlineMultiplier" :setting="data.settings.offlineMultiplier" label="Offline" before="after" after="missed polls">
            <template #note="{ value }">
              {{ offlineNote(value, onlyDevice) }}
            </template>
          </InstanceSettingRow>
          <InstanceSettingRow setting-key="fetchFailureThreshold" :setting="data.settings.fetchFailureThreshold" label="Fetch Failure Streak" before="of" after="failed fetches">
            <template #note="{ value }">
              {{ fetchFailureStreakNote(value) }}
            </template>
          </InstanceSettingRow>
          <p class="under-section">
            A change applies at the next Alert Sweep, within 5 minutes.
          </p>
        </InstanceSection>

        <InstanceSection id="notifications" title="Notifications">
          <template v-if="data.facts.notifications.configured">
            <ReadRow label="Apprise">
              <code class="value">{{ data.facts.notifications.appriseUrl }}</code>
              <template #side>
                From <code class="variable">KUROSHIRO_APPRISE_URL</code>
              </template>
              <template #note>
                Each Alert is announced there when it fires and again when it resolves. Which channels it reaches is set in Apprise.
              </template>
            </ReadRow>
            <TestNotificationRow />
          </template>
          <template v-else>
            <p class="off">
              <b>Notifications are off.</b> Alerts still fire and show here; nothing is sent anywhere.
            </p>
            <p class="under-section">
              To turn them on, run an Apprise sidecar, set <code class="variable">KUROSHIRO_APPRISE_URL</code> to its address and restart Kuroshiro. Alerts that fired while Notifications were off are announced then.
            </p>
          </template>
        </InstanceSection>

        <InstanceSection id="retention" title="Retention">
          <template #aside>
            <RouterLink class="link" :to="HOUSEKEEPING_PATH">
              Housekeeping
            </RouterLink>
          </template>
          <InstanceSettingRow setting-key="alertRetentionDays" :setting="data.settings.alertRetentionDays" label="Resolved Alerts" before="kept for" after="days">
            <template #note="{ value }">
              {{ resolvedAlertsNote(value) }}
            </template>
          </InstanceSettingRow>
          <InstanceSettingRow setting-key="deviceLogRetentionDays" :setting="data.settings.deviceLogRetentionDays" label="Device Log entries" before="kept for" after="days">
            <template #note="{ value }">
              {{ deviceLogEntriesNote(value) }}
            </template>
          </InstanceSettingRow>
          <p class="under-section">
            Retention runs every day at 04:00, server time. A change applies at the next run.
          </p>
        </InstanceSection>

        <InstanceSection id="fixed" title="Set where Kuroshiro is started">
          <p class="under-section intro">
            Read from the environment at start. To change one, change the variable and restart Kuroshiro.
          </p>
          <ReadRow label="Server URL">
            <code class="value">{{ data.facts.serverUrl }}</code>
            <template #note>
              The address every Device is given for its images and Firmware. <code class="variable">KUROSHIRO_API_URL</code>
            </template>
          </ReadRow>
          <ReadRow label="Timezone">
            {{ data.facts.timezone }}
            <template #note>
              Schedules, Sleep Mode and the 04:00 jobs run on this clock. <code class="variable">TZ</code>
            </template>
          </ReadRow>
          <ReadRow label="Metrics">
            <code class="value">{{ metricsUrl(data.facts.serverUrl) }}</code>
            <template #note>
              For Prometheus: battery, signal and last seen per Device, firing Alerts per kind. Anyone who can reach this server can read it.
            </template>
          </ReadRow>
          <ReadRow label="Demo mode">
            {{ data.facts.demoMode ? 'On' : 'Off' }}
            <template #note>
              {{ data.facts.demoMode ? 'Image uploads are refused and Kuroshiro only fetches public addresses.' : 'While on, image uploads are refused.' }}
              <code class="variable">KUROSHIRO_DEMO_MODE</code>
            </template>
          </ReadRow>
        </InstanceSection>

        <p class="last">
          Firmware Auto-Update is an Instance Setting too. It is switched on the
          <RouterLink v-slot="{ href, navigate }" custom :to="FIRMWARE_PATH">
            <a class="link" :href="href" @click="navigate">Firmware</a>
          </RouterLink>
          page.
        </p>
      </template>
    </LoadBody>
  </div>
</template>

<style scoped>
@layer components {
  .body {
    margin-top: var(--space-3);
  }

  .lede,
  .under-section,
  .last {
    color: var(--color-ink-soft);
    text-wrap: pretty;
  }

  .lede,
  .under-section {
    max-width: var(--measure);
  }

  .intro {
    margin-bottom: var(--space-2);
  }

  .first {
    margin-top: var(--space-8);
  }

  .under-section {
    margin-top: var(--space-3);
  }

  .last {
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: var(--rule);
  }

  .skeleton-row {
    display: grid;
    grid-template-columns: var(--setting-label-width, 12.5rem) minmax(0, 1fr);
    align-items: center;
    gap: var(--space-4);
    min-height: 3.25rem;
  }

  @media (max-width: 820px) {
    .skeleton-row {
      grid-template-columns: minmax(0, 1fr);
      align-content: center;
      gap: var(--space-2);
    }
  }

  .off {
    max-width: var(--measure);
    margin-top: var(--space-3);
  }

  .off b {
    font-weight: var(--weight-semibold);
  }

  .value,
  .variable {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .variable {
    font-size: var(--text-xs);
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
