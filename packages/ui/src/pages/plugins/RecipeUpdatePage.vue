<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getPlugin } from '@/api/plugins'
import LoadBody from '@/patterns/LoadBody.vue'
import MissingPage from '@/patterns/MissingPage.vue'
import PageSection from '@/patterns/PageSection.vue'
import TitleLine from '@/patterns/TitleLine.vue'
import { useLoad } from '@/patterns/useLoad'
import { pluginPath, PLUGINS_PATH } from './pluginPaths'
import RecipeCheckEmpty from './RecipeCheckEmpty.vue'
import RecipeUpdateCheck from './RecipeUpdateCheck.vue'

const route = useRoute()
const pluginId = computed(() => route.params.pluginId === undefined ? undefined : String(route.params.pluginId))

const load = useLoad(() => getPlugin(pluginId.value!), { key: () => pluginId.value })
const called = computed(() => load.data?.name ?? 'the Plugin')
const back = computed(() => ({ label: load.data?.name ?? 'Plugin', to: pluginPath(pluginId.value ?? '') }))
</script>

<template>
  <MissingPage v-if="load.missing" title="No Plugin here" :back="{ label: 'All Plugins', to: PLUGINS_PATH }">
    It may have been deleted.
  </MissingPage>
  <template v-else>
    <TitleLine :title="load.data?.name ?? 'Plugin'" :back="back" />
    <PageSection class="check" title="Recipe Update Check">
      <LoadBody v-slot="{ data }" :load="load" :loading="`Loading ${called}`" :failed="`Could not load ${called}.`">
        <RecipeUpdateCheck v-if="data.recipe" :key="data.id" :plugin="data" :recipe="data.recipe" />
        <RecipeCheckEmpty v-else title="Not from a Recipe" :plugin="data">
          {{ data.name }} was not imported from a Recipe, so there is nothing to check.
        </RecipeCheckEmpty>
      </LoadBody>
    </PageSection>
  </template>
</template>

<style scoped>
@layer components {
  .check {
    margin-top: 0;
  }
}
</style>
