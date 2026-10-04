<script setup lang="ts">
import type { DataSourceRead } from 'kuroshiro-shared'
import { computed } from 'vue'
import { getInstanceSettings } from '@/api/instance'
import CodeBlock from '@/components/CodeBlock.vue'
import RelativeTime from '@/patterns/RelativeTime.vue'
import { useLoad } from '@/patterns/useLoad'
import { failedScheduledFetches, FIRING_ALERT_STORY } from './pluginDataSourceWording'
import PluginRowStateCell from './PluginRowStateCell.vue'

/** The story of a Data Source with a Fetch Failure Streak: the streak, the server's last error, what the template gets, and when an Alert fires. */
const props = defineProps<{
  facts: DataSourceRead
  /** The name the template reads the Data Source by, as it is entered. */
  name: string
  pluginName: string
}>()

const settings = useLoad(getInstanceSettings)
const streak = computed(() => `Its Fetch Failure Streak is ${props.facts.fetchFailureStreak}: ${failedScheduledFetches(props.facts.fetchFailureStreak)}`)
const threshold = computed(() => settings.data?.fetchFailureThreshold.value)
</script>

<template>
  <p v-if="facts.alertFiring">
    <PluginRowStateCell :state="FIRING_ALERT_STORY" />
  </p>
  <p v-if="facts.lastFetchAttemptAt">
    {{ streak }}, most recently <RelativeTime :at="facts.lastFetchAttemptAt" />.
  </p>
  <p v-else>
    {{ streak }}.
  </p>
  <CodeBlock v-if="facts.lastFetchError" :code="facts.lastFetchError" />
  <p>
    {{ pluginName }} still renders. <code v-text="`{{ ${name} }}`" /> carries an error marker instead of data until a fetch succeeds.
  </p>
  <p v-if="!facts.alertFiring && threshold !== undefined">
    An Alert fires when the streak reaches {{ threshold }}.
  </p>
</template>
