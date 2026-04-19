<script setup lang="ts">
import type { Plugin } from '../types/plugin'
import { mdiAccountMultiple, mdiDelete, mdiDownload, mdiPencil, mdiPower } from '@mdi/js'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { VBtn, VCard, VCardActions, VCardText, VCardTitle, VChip, VDialog, VDivider, VSnackbar, VSpacer } from 'vuetify/components'
import { usePluginsStore } from '../stores/plugins'
import PluginAssignDialog from './PluginAssignDialog.vue'

const props = defineProps<{
  plugin: Plugin
  deviceId?: string
}>()

const emit = defineEmits<{
  assignmentsChanged: []
  deleted: []
}>()

const router = useRouter()
const pluginsStore = usePluginsStore()

const showAssignDialog = ref(false)
const showDeleteDialog = ref(false)
const showExportSnackbar = ref(false)

const assignedCount = computed(() => props.plugin.deviceAssignments?.length || 0)

const loadingDelete = ref(false)
async function confirmDelete() {
  loadingDelete.value = true
  try {
    await pluginsStore.deletePlugin(props.plugin.id, props.deviceId)
    showDeleteDialog.value = false
    emit('deleted')
  }
  finally {
    loadingDelete.value = false
  }
}

function deletePlugin() {
  showDeleteDialog.value = true
}

const loadingToggle = ref(false)
async function toggleActive() {
  loadingToggle.value = true
  try {
    // If we have deviceId and _devicePluginId, toggle assignment
    if (props.deviceId && props.plugin._devicePluginId) {
      await pluginsStore.updateDeviceAssignment(props.plugin._devicePluginId, {
        isActive: !props.plugin._isActive,
      })
      if (props.deviceId) {
        await pluginsStore.fetchPluginsForDevice(props.deviceId)
      }
    }
  }
  finally {
    loadingToggle.value = false
  }
}

function editPlugin() {
  router.push({ name: 'pluginEdit', params: { id: props.plugin.id } })
}

function exportPlugin() {
  window.location.href = `/api/plugins/${props.plugin.id}/export`
  showExportSnackbar.value = true
}

function openAssignDialog() {
  showAssignDialog.value = true
}

function onAssigned() {
  emit('assignmentsChanged')
}
</script>

<template>
  <VCard elevation="1" class="h-100">
    <VSnackbar v-model="showExportSnackbar" :timeout="3000" color="success">
      Downloading plugin export...
    </VSnackbar>
    <VCardTitle class="d-flex align-center justify-space-between">
      <span>{{ plugin.name }}</span>
      <div class="d-flex ga-2">
        <VChip
          v-if="!deviceId && assignedCount > 0"
          :prepend-icon="mdiAccountMultiple"
          size="small"
          variant="tonal"
        >
          {{ assignedCount }} device{{ assignedCount !== 1 ? 's' : '' }}
        </VChip>
        <VChip
          v-if="deviceId"
          :color="plugin._isActive ? 'success' : 'default'"
          size="small"
          variant="tonal"
        >
          {{ plugin._isActive ? 'Active' : 'Inactive' }}
        </VChip>
      </div>
    </VCardTitle>
    <VDivider />
    <VCardText>
      <div v-if="plugin.description" class="text-body-2 text-medium-emphasis">
        {{ plugin.description }}
      </div>
      <div v-else class="text-body-2 text-disabled">
        No description
      </div>
    </VCardText>
    <VCardActions class="d-flex ga-2 flex-wrap">
      <VBtn
        variant="tonal"
        size="small"
        :prepend-icon="mdiPencil"
        @click="editPlugin"
      >
        Edit
      </VBtn>
      <VBtn
        v-if="!deviceId"
        variant="tonal"
        size="small"
        :prepend-icon="mdiAccountMultiple"
        @click="openAssignDialog"
      >
        Assign to Devices
      </VBtn>
      <VBtn
        v-if="deviceId"
        variant="tonal"
        size="small"
        :prepend-icon="mdiPower"
        :color="plugin._isActive ? 'default' : 'success'"
        :loading="loadingToggle"
        @click="toggleActive"
      >
        {{ plugin._isActive ? 'Disable' : 'Enable' }}
      </VBtn>
      <VBtn
        variant="tonal"
        size="small"
        :prepend-icon="mdiDownload"
        @click="exportPlugin"
      >
        Export
      </VBtn>
      <VSpacer />
      <VBtn
        variant="tonal"
        size="small"
        color="error"
        :prepend-icon="mdiDelete"
        :loading="loadingDelete"
        @click="deletePlugin"
      >
        Delete
      </VBtn>
    </VCardActions>

    <PluginAssignDialog
      v-model="showAssignDialog"
      :plugin="plugin"
      @assigned="onAssigned"
    />

    <VDialog v-model="showDeleteDialog" max-width="500">
      <VCard>
        <VCardTitle>Delete Plugin?</VCardTitle>
        <VDivider />
        <VCardText>
          <p class="mb-2">
            Are you sure you want to delete <strong>{{ plugin.name }}</strong>?
          </p>
          <p v-if="assignedCount > 0" class="text-error">
            This plugin is assigned to {{ assignedCount }} device{{ assignedCount !== 1 ? 's' : '' }}. Deleting it will remove it from all devices.
          </p>
          <p class="text-medium-emphasis text-body-2">
            This action cannot be undone.
          </p>
        </VCardText>
        <VDivider />
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="showDeleteDialog = false">
            Cancel
          </VBtn>
          <VBtn
            color="error"
            variant="tonal"
            :loading="loadingDelete"
            @click="confirmDelete"
          >
            Delete
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </VCard>
</template>
