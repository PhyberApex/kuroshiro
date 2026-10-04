<script setup lang="ts">
import type { DeviceLogLevelFilter } from 'kuroshiro-shared'
import type { LogFilter } from './deviceLogWording'
import { DEVICE_LOG_SEARCH_MIN_LENGTH } from 'kuroshiro-shared'
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { clearDeviceLogs } from '@/api/devices'
import { getInstanceSettings } from '@/api/instance'
import Button from '@/components/Button.vue'
import Confirmation from '@/components/Confirmation.vue'
import EmptyState from '@/components/EmptyState.vue'
import Notice from '@/components/Notice.vue'
import { useLoad } from '@/patterns/useLoad'
import { useDeviceFrame } from './deviceFrame'
import { useDeviceLog } from './deviceLog'
import DeviceLogBar from './DeviceLogBar.vue'
import DeviceLogEntries from './DeviceLogEntries.vue'
import DeviceLogFoot from './DeviceLogFoot.vue'
import DeviceLogLoading from './DeviceLogLoading.vue'
import { countLine, newEntriesLabel, noMatchSentence, retentionSentence } from './deviceLogWording'
import { possessive } from './screenNaming'

const SEARCH_WAITS_MS = 300

const route = useRoute()
const router = useRouter()
const { name } = useDeviceFrame()

const deviceId = () => typeof route.params.deviceId === 'string' ? route.params.deviceId : undefined
const searchable = (typed: string) => typed.trim().length >= DEVICE_LOG_SEARCH_MIN_LENGTH ? typed.trim() : ''

function holdInAddress(changes: { level?: DeviceLogLevelFilter, q?: string }) {
  void router.replace({ query: { ...route.query, ...changes } })
}

const level = computed<DeviceLogLevelFilter>({
  get: () => route.query.level === 'problems' ? 'problems' : 'all',
  set: chosen => holdInAddress({ level: chosen === 'problems' ? chosen : undefined }),
})
const sought = computed(() => typeof route.query.q === 'string' ? searchable(route.query.q) : '')
const filter = computed<LogFilter>(() => ({ level: level.value, q: sought.value }))
const filtered = computed(() => level.value === 'problems' || sought.value !== '')

const typed = ref(sought.value)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(typed, (now) => {
  clearTimeout(searchTimer)
  if (searchable(now) !== sought.value)
    searchTimer = setTimeout(() => holdInAddress({ q: searchable(now) || undefined }), SEARCH_WAITS_MS)
})
// The address changed under the field: "Show all entries", or the browser's back button.
watch(sought, (now) => {
  if (searchable(typed.value) !== now)
    typed.value = now
})

function showAll() {
  clearTimeout(searchTimer)
  typed.value = ''
  holdInAddress({ level: undefined, q: undefined })
}

const log = useDeviceLog(deviceId, () => filter.value)
const settings = useLoad(getInstanceSettings)
const retention = computed(() => settings.data && retentionSentence(settings.data.deviceLogRetentionDays.value))

const opened = ref<string>()
const total = computed(() => log.shown?.total ?? 0)
const counted = computed(() => log.shown
  ? countLine({ shown: log.shown.entries.length, total: log.shown.total, matching: log.shown.matching, filtered: filtered.value })
  : '')

async function showOlder() {
  const firstOlder = await log.loadOlder()
  if (!firstOlder)
    return
  await nextTick()
  document.getElementById(`log-entry-${firstOlder}`)?.focus()
}

const clearing = ref(false)
const lostEntries = computed(() => total.value === 1
  ? `The one entry of ${possessive(name.value)} Device Log.`
  : `All ${total.value} entries of ${possessive(name.value)} Device Log.`)
</script>

<template>
  <DeviceLogBar v-model:level="level" v-model:search="typed" :clearable="total > 0" @clear="clearing = true" />
  <Notice
    v-if="log.first.failure"
    class="log-notice"
    :title="`Could not load ${possessive(name)} Logs.`"
    :reason="log.first.failure.reason"
    action="Try again"
    @act="log.reload"
  />
  <template v-if="log.shown">
    <div class="log-meta">
      <p class="counted" role="status">
        {{ counted }}
      </p>
      <Button v-if="log.arrived > 0" variant="quiet" :loading="log.loadingNew" @click="log.loadNew">
        {{ newEntriesLabel(log.arrived) }}
      </Button>
    </div>
    <Notice v-if="log.stumble" class="log-notice" :title="log.stumble.title" :reason="log.stumble.reason" />
    <EmptyState v-if="total === 0" title="No Device Log entries yet">
      {{ name }} sends an entry when something goes wrong on its side. They appear here after its next poll.
    </EmptyState>
    <EmptyState v-else-if="log.shown.entries.length === 0" title="No entry matches">
      {{ noMatchSentence(name, filter) }}
      <template #action>
        <Button @click="showAll">
          Show all entries
        </Button>
      </template>
    </EmptyState>
    <template v-else>
      <DeviceLogEntries v-model:open="opened" :device-name="name" :entries="log.shown.entries" :sought="sought" />
      <DeviceLogFoot :more="log.shown.nextCursor !== null" :loading="log.loadingOlder" :retention="retention" @older="showOlder" />
    </template>
  </template>
  <DeviceLogLoading v-else-if="!log.first.failure" :device-name="name" :waiting="log.first.waiting" />
  <Confirmation
    v-model:open="clearing"
    :title="`Clear ${possessive(name)} Logs?`"
    confirm-label="Clear Logs"
    :action="() => clearDeviceLogs(String(deviceId()))"
    @confirmed="log.reload"
  >
    <template #lost>
      {{ lostEntries }}
    </template>
    <template #stays>
      Nothing else changes. New entries arrive with the next poll.
    </template>
  </Confirmation>
</template>

<style scoped>
@layer components {
  .log-notice {
    margin-top: var(--space-4);
  }

  .log-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-height: var(--hit-target);
    margin-top: var(--space-2);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
