<script setup lang="ts">
import type { PluginDetail } from 'kuroshiro-shared'
import { computed, shallowRef, watch } from 'vue'
import { getPlugin } from '@/api/plugins'
import LoadBody from '@/patterns/LoadBody.vue'
import MissingPage from '@/patterns/MissingPage.vue'
import TitleLine from '@/patterns/TitleLine.vue'
import { useLoad } from '@/patterns/useLoad'
import { takePluginArrival } from './pluginArrival'
import PluginLoading from './PluginLoading.vue'
import PluginOpened from './PluginOpened.vue'
import { PLUGINS_PATH } from './pluginPaths'

/**
 * The Plugin page around its sections: the load and its states, the title line, and once the
 * Plugin is there the one form the sections join. Give it a `key` of the Plugin's id, so that
 * another Plugin starts a page of its own.
 */
const props = defineProps<{
  pluginId: string
}>()

defineSlots<{
  /** The page's sections, in order. The Plugin is handed to them for a section that only some Plugins have. */
  default?: (props: { plugin: PluginDetail }) => unknown
  /** The tucked sections at the bottom. */
  tucked?: (props: { plugin: PluginDetail }) => unknown
}>()

const load = useLoad(() => getPlugin(props.pluginId), { fresh: true })
const arrival = takePluginArrival(props.pluginId)

/** What a save answered, which is the Plugin until the next read arrives. */
const answered = shallowRef<PluginDetail>()
watch(() => load.data, () => (answered.value = undefined))
const plugin = computed(() => answered.value ?? load.data)

function saved(answer: PluginDetail) {
  answered.value = answer
  // The server renders again after it answers, so the answer's fetch and render facts are a moment old.
  void load.reload()
}

const back = { label: 'All Plugins', to: PLUGINS_PATH }
const called = computed(() => plugin.value?.name ?? 'the Plugin')
</script>

<template>
  <MissingPage v-if="load.missing" title="No Plugin here" :back="back">
    It may have been deleted.
  </MissingPage>
  <template v-else>
    <TitleLine :title="plugin?.name ?? 'Plugin'" :back="back" />
    <LoadBody :load="load" :loading="`Loading ${called}`" :failed="`Could not load ${called}.`">
      <PluginOpened v-if="plugin" :plugin="plugin" :arrival="arrival" :reload="load.reload" @saved="saved">
        <template #default="opened">
          <slot v-bind="opened" />
        </template>
        <template #tucked="opened">
          <slot name="tucked" v-bind="opened" />
        </template>
      </PluginOpened>
      <template #skeleton>
        <PluginLoading />
      </template>
    </LoadBody>
  </template>
</template>
