<script setup lang="ts">
import type { AddPluginWay } from './pluginPaths'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import RadioRow from '@/components/RadioRow.vue'
import { devicePath } from '@/pages/devices/devicePaths'
import ChoiceBesideForm from '@/patterns/ChoiceBesideForm.vue'
import TitleLine from '@/patterns/TitleLine.vue'
import { chosenWay } from './addPlugin'
import { addPluginOrigin } from './addPluginOrigin'
import { provideAddPluginPage } from './addPluginPage'
import { ADD_PLUGIN_WAYS } from './addPluginWays'
import { useCarriedDevice } from './carriedDevice'
import { PLUGINS_PATH } from './pluginPaths'

const route = useRoute()
const router = useRouter()

const ways = ADD_PLUGIN_WAYS.map(({ way, label, hint }) => ({ value: way, label, hint }))
const chosen = computed(() => chosenWay(ADD_PLUGIN_WAYS, route.query.way))
const { device, settled, back } = useCarriedDevice()

provideAddPluginPage({
  device,
  cancelTo: computed(() => device.value ? devicePath(device.value.id) : addPluginOrigin() ?? PLUGINS_PATH),
})

function choose(way?: AddPluginWay) {
  if (way)
    void router.replace({ query: { ...route.query, way } })
}
</script>

<template>
  <TitleLine title="Add a Plugin" :back="back" />
  <p v-if="device" class="carried">
    It is assigned to {{ device.name }} as soon as it exists, at the end of the Order.
  </p>
  <ChoiceBesideForm>
    <template #choice>
      <RadioRow
        :model-value="chosen.way"
        :choices="ways"
        aria-label="Way to add a Plugin"
        @update:model-value="choose"
      />
    </template>
    <component :is="chosen.form" v-if="settled" v-bind="chosen.props" />
  </ChoiceBesideForm>
</template>

<style scoped>
@layer components {
  .carried {
    max-width: var(--measure);
    margin-top: calc(-1 * var(--space-2));
    margin-bottom: var(--space-4);
    color: var(--color-ink-soft);
  }
}
</style>
