<script setup lang="ts">
import type { Plugin } from '@/types/plugin'
import { mdiPlus, mdiPuzzle } from '@mdi/js'
import { computed, onMounted, ref } from 'vue'
import { VAlert, VBtn, VCard, VCardText, VCardTitle, VDivider, VSelect } from 'vuetify/components'
import { usePluginsStore } from '@/stores/plugins'
import { useScreensStore } from '@/stores/screens'
import { errorMessage } from '@/utils/errorMessage'

const props = defineProps<{ deviceId: string }>()

const pluginsStore = usePluginsStore()
const screensStore = useScreensStore()

const allPlugins = ref<Plugin[]>([])
const selectedPluginId = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

function isAssignedHere(plugin: Plugin) {
  return plugin.deviceAssignments?.some(assignment => assignment.device.id === props.deviceId) ?? false
}

const availablePlugins = computed(() =>
  allPlugins.value
    .filter(plugin => !isAssignedHere(plugin))
    .map(plugin => ({ title: plugin.name, value: plugin.id })),
)

const createLink = computed(() => ({ name: 'pluginCreate', query: { deviceId: props.deviceId } }))

async function loadPlugins() {
  allPlugins.value = await pluginsStore.fetchAllPlugins()
}

onMounted(async () => {
  try {
    await loadPlugins()
  }
  catch (err) {
    error.value = errorMessage(err, 'Failed to load plugins')
  }
})

async function assignPlugin() {
  if (!selectedPluginId.value)
    return
  error.value = null
  loading.value = true
  try {
    await pluginsStore.assignToDevice(selectedPluginId.value, props.deviceId)
    await Promise.all([screensStore.fetchScreensForDevice(props.deviceId), loadPlugins()])
    selectedPluginId.value = ''
  }
  catch (err) {
    error.value = errorMessage(err, 'Failed to assign plugin')
  }
  finally {
    loading.value = false
  }
}

defineExpose({ availablePlugins, selectedPluginId })
</script>

<template>
  <VCard elevation="1">
    <VCardTitle>Add Plugin Screen</VCardTitle>
    <VDivider />
    <VCardText>
      <VAlert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = null">
        {{ error }}
      </VAlert>

      <VAlert v-if="!availablePlugins.length && !error" type="info" variant="tonal" class="mb-4" data-test-id="plugin-empty-state">
        Every existing plugin is already on this device, or none exist yet.
      </VAlert>

      <template v-else>
        <VSelect
          v-model="selectedPluginId"
          :items="availablePlugins"
          label="Plugin"
          item-title="title"
          item-value="value"
          class="mb-4"
          data-test-id="plugin-select"
        />

        <VBtn
          color="primary"
          :prepend-icon="mdiPuzzle"
          :disabled="!selectedPluginId || loading"
          :loading="loading"
          block
          class="mb-4"
          data-test-id="plugin-assign-btn"
          @click="assignPlugin"
        >
          Add Screen
        </VBtn>
      </template>

      <VBtn
        variant="text"
        color="secondary"
        :prepend-icon="mdiPlus"
        :to="createLink"
        data-test-id="create-plugin-link"
      >
        Create new plugin
      </VBtn>
    </VCardText>
  </VCard>
</template>
