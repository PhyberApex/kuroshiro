<script setup lang="ts">
import type { PreviewData } from 'kuroshiro-shared'
import { computed } from 'vue'
import Icon from '@/components/Icon.vue'
import Notice from '@/components/Notice.vue'
import TuckedSection from '@/components/TuckedSection.vue'
import { exactTime, relativeTime } from '@/patterns/time'
import { useNow } from '@/patterns/useNow'
import DataList from './DataList.vue'
import { usePluginPage } from './pluginPage'
import { dataRowsOf, namesCount, unfetchedSources } from './templateData'
import TemplateDataFoot from './TemplateDataFoot.vue'

/** What the preview says about its data, under the honest line: what could not be fetched, and "Data", every name the Template can read. */
const props = defineProps<{
  /** The data the preview draws against, once there is any. */
  data: PreviewData | undefined
  fetching: boolean
  /** Why the last fetch gave no data, as a sentence. */
  failure: string | undefined
  /** The Device the preview is for, if any: its Sensors are its own. */
  deviceName: string | null
}>()

defineEmits<{
  /** "Fetch again" or "Try again" was pressed. */
  fetch: []
}>()

const open = defineModel<boolean>('open', { required: true })

const { plugin, form } = usePluginPage()
const now = useNow()

const source = computed(() => {
  if (plugin.value.kind === 'Webhook')
    return 'received'
  return (form.unsaved.dataSources ?? plugin.value.dataSources).length > 0 ? 'fetched' : 'none'
})

/** "4 min ago", or the exact time of a fetch that is over a day old. The tucked section's title and the notice hold it as words. */
const fetchedWhen = computed(() => {
  if (!props.data)
    return undefined
  const at = new Date(props.data.fetchedAt)
  return relativeTime(at, now.value) ?? exactTime(at)
})

const note = computed(() => props.data && `${namesCount(props.data.names.length)}${source.value === 'fetched' ? `, fetched ${fetchedWhen.value}` : ''}`)
const rows = computed(() => props.data ? dataRowsOf(props.data, props.deviceName) : [])
const unfetched = computed(() => props.data ? unfetchedSources(props.data) : [])
const notAnswered = computed(() => props.failure && `${props.failure}${fetchedWhen.value ? ` The preview uses the data from ${fetchedWhen.value}.` : ''}`)
</script>

<template>
  <div class="template-data">
    <div class="data-notices">
      <Notice v-if="notAnswered" title="The data could not be fetched." :reason="notAnswered" action="Try again" @act="$emit('fetch')" />
      <p v-for="failed in unfetched" :key="failed.name" class="unfetched">
        <Icon name="problem" class="mark" />
        <span>The Data Source <code class="name">{{ failed.name }}</code> could not be fetched: {{ failed.reason }}</span>
      </p>
    </div>
    <TuckedSection v-if="data" id="template-data" v-model:open="open" class="data" title="Data" :note="note" heading="h3">
      <DataList :rows="rows" />
      <TemplateDataFoot :source="source" :fetching="fetching" :received-at="data.webhookPayloadReceivedAt" @fetch="$emit('fetch')" />
    </TuckedSection>
  </div>
</template>

<style scoped>
@layer components {
  .data-notices:not(:empty) {
    margin-top: var(--space-3);
  }

  /* Between two rules, in ink with the problem icon: the Template is still drawn, with the error marker. */
  .unfetched {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    padding: var(--space-2) 0;
    border-block: var(--rule);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .unfetched + .unfetched {
    border-top: 0;
  }

  .unfetched .mark {
    flex: none;
    margin-top: calc((1lh - var(--icon)) / 2);
  }

  .unfetched .name {
    font-family: var(--font-mono);
  }

  .unfetched span {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .template-data .data {
    margin-top: var(--space-4);
  }
}
</style>
