<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PluginActions from './PluginActions.vue'
import PluginFrame from './PluginFrame.vue'
import PluginNaming from './PluginNaming.vue'

const route = useRoute()

// The parameter is gone while the route leaves; the page stands as it is until then.
const pluginId = ref(String(route.params.pluginId))
watch(() => route.params.pluginId, (id) => {
  if (id != null)
    pluginId.value = String(id)
})
</script>

<template>
  <!--
    The sections of the Plugin page, in the spec's order. Each is one component that stands in its
    place below; `plugin` is there for a section only some Plugins have (`v-if="plugin.recipe"`).
  -->
  <PluginFrame :key="pluginId" :plugin-id="pluginId">
    <template #default>
      <!-- #template: Template -->
      <!-- #data: Data Sources for a Poll-kind Plugin, Webhook for a Webhook-kind one -->
      <!-- #values: Field Values -->
      <!-- #devices: Devices -->
      <!-- #recipe: Recipe -->
    </template>
    <template #tucked>
      <!-- #fields: Plugin Fields -->
      <PluginNaming />
      <PluginActions />
    </template>
  </PluginFrame>
</template>
