<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import { computed, ref } from 'vue'
import { listPlugins } from '@/api/plugins'
import { assignPlugin } from '@/api/screens'
import RadioRow from '@/components/RadioRow.vue'
import SearchField from '@/components/SearchField.vue'
import { addPluginPath } from '@/pages/plugins/pluginPaths'
import LoadBody from '@/patterns/LoadBody.vue'
import { useLoad } from '@/patterns/useLoad'
import { pluginChoices, pluginsCalled, preselected } from './addScreen'
import AddScreenFoot from './AddScreenFoot.vue'
import { useAddScreen } from './addScreenForm'
import NoPluginToAssign from './NoPluginToAssign.vue'
import { linkTo, sentence } from './sentence'
import SentenceLine from './SentenceLine.vue'

const props = defineProps<{
  device: DeviceDetail
}>()

/** A list this long is searched rather than read. */
const SEARCHED_FROM = 9

const plugins = useLoad(listPlugins)
const addition = useAddScreen([], 'Not assigned.')

const query = ref('')
const picked = ref<string>()

const choices = computed(() => pluginChoices(pluginsCalled(plugins.data ?? [], query.value), props.device))
const chosen = computed(() => preselected(choices.value, picked.value))
const shortcut = computed(() => sentence(
  'No Plugin for it yet? ',
  linkTo('Import a Recipe or build one', addPluginPath('recipe', props.device.id)),
  `; it is assigned to ${props.device.name} when you save it.`,
))
const changed = computed(() => !addition.added && (picked.value !== undefined || query.value.trim() !== ''))

function assign() {
  const pluginId = chosen.value
  if (pluginId)
    void addition.create(() => assignPlugin(pluginId, { deviceId: props.device.id }))
}
</script>

<template>
  <LoadBody v-slot="{ data }" :load="plugins" loading="Loading the Plugins" failed="Could not load the Plugins.">
    <NoPluginToAssign v-if="data.length === 0" :device="device" />
    <form v-else class="add-plugin-screen" novalidate @submit.prevent="assign">
      <SearchField v-if="data.length >= SEARCHED_FROM" v-model="query" aria-label="Find a Plugin" placeholder="Find a Plugin" />
      <div v-if="choices.length > 0" class="plugins">
        <RadioRow :model-value="chosen" :choices="choices" aria-label="Plugin" @update:model-value="picked = $event" />
      </div>
      <p v-else class="none-found">
        No Plugin is called “{{ query.trim() }}”.
      </p>
      <SentenceLine class="shortcut" :sentence="shortcut" />
      <AddScreenFoot button="Assign Plugin" :running="addition.running" :disabled="!chosen" :changed="changed" :failure="addition.failure" />
    </form>
  </LoadBody>
</template>

<style scoped>
@layer components {
  .add-plugin-screen {
    display: grid;
    gap: var(--space-4);
  }

  .plugins {
    max-height: 22rem;
    overflow-y: auto;
  }

  .none-found,
  .shortcut {
    color: var(--color-ink-soft);
  }
}
</style>
