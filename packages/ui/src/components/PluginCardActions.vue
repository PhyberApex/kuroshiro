<script setup lang="ts">
import type { Plugin } from '../types/plugin'
import type { RecipeUpdatePreview } from '../types/recipeUpdate'
import { mdiAccountMultiple, mdiCloudSync, mdiContentCopy, mdiDelete, mdiDownload, mdiPencil } from '@mdi/js'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { VBtn, VCard, VCardActions, VCardText, VCardTitle, VDialog, VDivider, VSnackbar, VSpacer } from 'vuetify/components'
import { usePluginsStore } from '../stores/plugins'
import { withBasePath } from '../utils/basePath'
import { errorMessage } from '../utils/errorMessage'
import PluginAssignDialog from './PluginAssignDialog.vue'
import PluginRecipeUpdateDialog from './PluginRecipeUpdateDialog.vue'

const props = defineProps<{
  plugin: Plugin
}>()

const emit = defineEmits<{
  assignmentsChanged: []
  duplicated: []
  deleted: []
  recipeUpdated: []
}>()

const router = useRouter()
const pluginsStore = usePluginsStore()

const showAssignDialog = ref(false)
const showDeleteDialog = ref(false)
const showExportSnackbar = ref(false)
const showDuplicateErrorSnackbar = ref(false)
const showRecipeUpdateSnackbar = ref(false)

const checkingForUpdate = ref(false)
const showRecipeUpdateDialog = ref(false)
const recipeUpdatePreview = ref<RecipeUpdatePreview | null>(null)
const recipeUpdateError = ref<string | null>(null)

const assignedCount = computed(() => props.plugin.deviceAssignments?.length || 0)

const loadingDelete = ref(false)
async function confirmDelete() {
  loadingDelete.value = true
  try {
    await pluginsStore.deletePlugin(props.plugin.id)
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

function editPlugin() {
  router.push({ name: 'pluginEdit', params: { id: props.plugin.id } })
}

const loadingDuplicate = ref(false)
async function duplicatePlugin() {
  loadingDuplicate.value = true
  try {
    await pluginsStore.duplicatePlugin(props.plugin.id)
    emit('duplicated')
  }
  catch {
    showDuplicateErrorSnackbar.value = true
  }
  finally {
    loadingDuplicate.value = false
  }
}

function exportPlugin() {
  window.location.href = withBasePath(`/api/plugins/${props.plugin.id}/export`)
  showExportSnackbar.value = true
}

function openAssignDialog() {
  showAssignDialog.value = true
}

function onAssigned() {
  emit('assignmentsChanged')
}

async function checkForUpdates() {
  checkingForUpdate.value = true
  try {
    recipeUpdatePreview.value = await pluginsStore.checkRecipeUpdate(props.plugin.id)
    recipeUpdateError.value = null
  }
  catch (err) {
    recipeUpdatePreview.value = null
    recipeUpdateError.value = errorMessage(err, 'Failed to check for Recipe updates')
  }
  finally {
    checkingForUpdate.value = false
    showRecipeUpdateDialog.value = true
  }
}

function onRecipeUpdateApplied() {
  showRecipeUpdateSnackbar.value = true
  emit('recipeUpdated')
}
</script>

<template>
  <VSnackbar v-model="showExportSnackbar" :timeout="3000" color="success">
    Downloading plugin export...
  </VSnackbar>
  <VSnackbar v-model="showDuplicateErrorSnackbar" :timeout="3000" color="error">
    Failed to duplicate plugin
  </VSnackbar>
  <VSnackbar v-model="showRecipeUpdateSnackbar" :timeout="3000" color="success">
    Recipe update applied
  </VSnackbar>
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
      variant="tonal"
      size="small"
      :prepend-icon="mdiAccountMultiple"
      @click="openAssignDialog"
    >
      Assign to Devices
    </VBtn>
    <VBtn
      v-if="plugin.sourceRecipeId"
      variant="tonal"
      size="small"
      :prepend-icon="mdiCloudSync"
      :loading="checkingForUpdate"
      @click="checkForUpdates"
    >
      Check for Updates
    </VBtn>
    <VBtn
      variant="tonal"
      size="small"
      :prepend-icon="mdiContentCopy"
      :loading="loadingDuplicate"
      @click="duplicatePlugin"
    >
      Duplicate
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

  <PluginRecipeUpdateDialog
    v-model="showRecipeUpdateDialog"
    :plugin="plugin"
    :preview="recipeUpdatePreview"
    :error="recipeUpdateError"
    @applied="onRecipeUpdateApplied"
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
</template>
