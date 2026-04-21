<script setup lang="ts">
import { mdiDownload, mdiPlus, mdiSync } from '@mdi/js'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { VAlert, VBtn, VCard, VCardText, VCardTitle, VCol, VContainer, VDivider, VRow } from 'vuetify/components'
import { VIconBtn } from 'vuetify/labs/VIconBtn'
import PluginCard from '../components/PluginCard.vue'
import { useDeviceStore } from '../stores/device'
import { usePluginsStore } from '../stores/plugins'

const props = defineProps<{
  deviceId: string
}>()

const router = useRouter()
const deviceStore = useDeviceStore()
const pluginsStore = usePluginsStore()

const device = computed(() => deviceStore.getById(props.deviceId))
const plugins = computed(() => pluginsStore.plugins)

const loadingUpdate = ref(false)
const showImportDialog = ref(false)

async function update() {
  loadingUpdate.value = true
  try {
    await pluginsStore.fetchPluginsForDevice(props.deviceId)
  }
  finally {
    loadingUpdate.value = false
  }
}

function createPlugin() {
  router.push({ name: 'pluginCreate', query: { deviceId: props.deviceId } })
}
</script>

<template>
  <VContainer fluid>
    <VRow justify="center">
      <VCol cols="12">
        <VCard elevation="1">
          <VCardTitle class="d-flex align-center justify-space-between">
            <div>
              <span>Plugins for </span>
              <span class="font-weight-bold">{{ device?.name }}</span>
            </div>
            <div class="d-flex ga-2">
              <VIconBtn
                :icon="mdiSync"
                variant="tonal"
                color="secondary"
                aria-label="Refresh plugins"
                :disabled="loadingUpdate"
                @click="update()"
              />
              <VBtn
                variant="tonal"
                color="secondary"
                :prepend-icon="mdiDownload"
                @click="showImportDialog = true"
              >
                Import
              </VBtn>
              <VBtn
                color="primary"
                variant="tonal"
                :prepend-icon="mdiPlus"
                @click="createPlugin"
              >
                Add Plugin
              </VBtn>
            </div>
          </VCardTitle>
          <VDivider />
          <VCardText>
            <VRow v-if="plugins.length">
              <VCol
                v-for="plugin in plugins"
                :key="plugin.id"
                cols="12"
                md="6"
                lg="4"
              >
                <PluginCard :plugin="plugin" :device-id="deviceId" @assignments-changed="update" @deleted="update" />
              </VCol>
            </VRow>
            <VAlert v-else type="info" variant="tonal" class="text-body-2">
              No plugins yet. Add one with the button above.
            </VAlert>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </VContainer>
</template>
