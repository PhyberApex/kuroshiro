<script setup lang="ts">
import type { Plugin } from '../types/plugin'
import { mdiPlus, mdiSync, mdiUpload } from '@mdi/js'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { VBtn, VCard, VCardText, VCardTitle, VCol, VContainer, VDivider, VRow, VTooltip } from 'vuetify/components'
import { VIconBtn } from 'vuetify/labs/VIconBtn'
import PluginCard from '../components/PluginCard.vue'
import PluginImportDialog from '../components/PluginImportDialog.vue'

const router = useRouter()

const plugins = ref<Plugin[]>([])
const loading = ref(false)
const showImportDialog = ref(false)

async function fetchAllPlugins() {
  loading.value = true
  try {
    const res = await fetch('/api/plugins')
    if (!res.ok)
      throw new Error('Failed to fetch plugins')
    plugins.value = await res.json()
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchAllPlugins()
})

function createPlugin() {
  router.push({ name: 'pluginCreate' })
}

function openImportDialog() {
  showImportDialog.value = true
}

function onPluginImported() {
  fetchAllPlugins()
}
</script>

<template>
  <VContainer fluid>
    <VRow justify="center">
      <VCol cols="12">
        <VCard elevation="1">
          <VCardTitle class="d-flex align-center justify-space-between">
            <span>All Plugins</span>
            <div class="d-flex ga-2">
              <VIconBtn
                :icon="mdiSync"
                variant="tonal"
                color="secondary"
                aria-label="Refresh plugins"
                :disabled="loading"
                @click="fetchAllPlugins"
              />
              <VBtn
                color="secondary"
                variant="tonal"
                :prepend-icon="mdiUpload"
                @click="openImportDialog"
              >
                Import Plugin
                <VTooltip activator="parent" location="bottom">
                  Import from Terminus or GitHub (Beta)
                </VTooltip>
              </VBtn>
              <VBtn
                color="primary"
                variant="tonal"
                :prepend-icon="mdiPlus"
                @click="createPlugin"
              >
                Create Plugin
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
                <PluginCard :plugin="plugin" @assignments-changed="fetchAllPlugins" @deleted="fetchAllPlugins" />
              </VCol>
            </VRow>
            <div v-else class="text-center py-12">
              <div class="text-h5 mb-2">
                No plugins yet
              </div>
              <p class="text-body-1 text-medium-emphasis mb-6">
                Plugins automatically fetch and display data on your TRMNL devices.
              </p>
              <div class="d-flex ga-4 justify-center flex-wrap">
                <VBtn
                  color="primary"
                  variant="tonal"
                  size="large"
                  :prepend-icon="mdiPlus"
                  @click="createPlugin"
                >
                  Create Your First Plugin
                </VBtn>
                <VBtn
                  color="secondary"
                  variant="tonal"
                  size="large"
                  :prepend-icon="mdiUpload"
                  @click="openImportDialog"
                >
                  Import from Terminus
                </VBtn>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <PluginImportDialog
      v-model="showImportDialog"
      @imported="onPluginImported"
    />
  </VContainer>
</template>
