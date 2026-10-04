<script setup lang="ts">
import { useRoute } from 'vue-router'
import { getPlugin } from '@/api/plugins'
import EmptyState from '@/components/EmptyState.vue'
import LoadBody from '@/patterns/LoadBody.vue'
import MissingPage from '@/patterns/MissingPage.vue'
import TitleLine from '@/patterns/TitleLine.vue'
import { useLoad } from '@/patterns/useLoad'
import { PLUGINS_PATH } from './pluginPaths'

const route = useRoute()
const plugin = useLoad(() => getPlugin(String(route.params.pluginId)), { key: () => route.params.pluginId })

const back = { label: 'All Plugins', to: PLUGINS_PATH }
</script>

<template>
  <MissingPage v-if="plugin.missing" title="No Plugin here" :back="back">
    It may have been deleted.
  </MissingPage>
  <template v-else>
    <TitleLine :title="plugin.data?.name ?? 'Plugin'" :back="back" />
    <LoadBody :load="plugin" loading="Loading the Plugin" failed="Could not load the Plugin.">
      <EmptyState title="Not built yet">
        This page of the rebuilt admin UI has not landed. The Plugin keeps fetching and rendering meanwhile.
      </EmptyState>
    </LoadBody>
  </template>
</template>
