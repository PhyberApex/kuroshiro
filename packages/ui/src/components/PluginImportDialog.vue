<script setup lang="ts">
import { mdiUpload } from '@mdi/js'
import { ref } from 'vue'
import { VAlert, VBtn, VCard, VCardActions, VCardText, VCardTitle, VDialog, VDivider, VFileInput, VSelect, VTab, VTabs, VTextField, VWindow, VWindowItem } from 'vuetify/components'
import { useDeviceStore } from '../stores/device'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'imported': []
}>()

const deviceStore = useDeviceStore()

const importTab = ref('file')
const selectedFile = ref<File | null>(null)
const githubUrl = ref('')
const recipeId = ref('')
const selectedDeviceId = ref('')
const loading = ref(false)
const error = ref('')

function onFileChange(files: File | File[]) {
  const fileArray = Array.isArray(files) ? files : [files]
  if (fileArray && fileArray.length > 0) {
    selectedFile.value = fileArray[0]
    error.value = ''
  }
}

async function importPlugin() {
  if (!selectedDeviceId.value) {
    error.value = 'Please select a device'
    return
  }

  loading.value = true
  error.value = ''

  try {
    if (importTab.value === 'file') {
      if (!selectedFile.value) {
        error.value = 'Please select a file'
        return
      }

      const formData = new FormData()
      formData.append('file', selectedFile.value)
      formData.append('deviceId', selectedDeviceId.value)

      const res = await fetch('/api/plugins/import', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || 'Import failed')
      }
    }
    else if (importTab.value === 'github') {
      if (!githubUrl.value) {
        error.value = 'Please enter a GitHub URL'
        return
      }

      const res = await fetch('/api/plugins/import-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubUrl: githubUrl.value,
          deviceId: selectedDeviceId.value,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || 'Import failed')
      }
    }
    else {
      if (!recipeId.value) {
        error.value = 'Please enter a Recipe id or URL'
        return
      }

      const res = await fetch('/api/plugins/import-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeId: recipeId.value,
          deviceId: selectedDeviceId.value,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || 'Import failed')
      }
    }

    emit('imported')
    close()
  }
  catch (err: any) {
    error.value = err.message || 'Failed to import plugin'
  }
  finally {
    loading.value = false
  }
}

function close() {
  emit('update:modelValue', false)
  selectedFile.value = null
  githubUrl.value = ''
  recipeId.value = ''
  selectedDeviceId.value = ''
  error.value = ''
}
</script>

<template>
  <VDialog :model-value="modelValue" max-width="600" @update:model-value="emit('update:modelValue', $event)">
    <VCard>
      <VCardTitle>Import Plugin</VCardTitle>
      <VDivider />
      <VCardText>
        <VAlert type="warning" variant="tonal" class="mb-4 text-body-2">
          <strong>Beta Feature:</strong> Terminus plugin import is experimental. Some plugins may not work correctly due to API authentication requirements or missing functionality.
        </VAlert>

        <VAlert v-if="error" type="error" variant="tonal" class="mb-4">
          {{ error }}
        </VAlert>

        <VTabs v-model="importTab" grow>
          <VTab value="file">
            Upload File
          </VTab>
          <VTab value="github">
            GitHub URL
          </VTab>
          <VTab value="recipe">
            Recipe
          </VTab>
        </VTabs>

        <VWindow v-model="importTab" class="mt-4">
          <VWindowItem value="file">
            <VFileInput
              :model-value="selectedFile ? [selectedFile] : []"
              label="Select .trmnlp.yml or .zip file"
              accept=".yml,.yaml,.zip"
              :prepend-icon="mdiUpload"
              show-size
              @update:model-value="onFileChange"
            />
            <VAlert type="info" variant="tonal" class="mt-4 text-body-2">
              Upload a Terminus plugin (.trmnlp.yml or .zip) to import it into Kuroshiro.
            </VAlert>
          </VWindowItem>

          <VWindowItem value="github">
            <VTextField
              v-model="githubUrl"
              label="GitHub Repository URL"
              placeholder="https://github.com/owner/repo"
              hint="Enter the URL of a GitHub repository containing a Terminus plugin"
              persistent-hint
            />
            <VAlert type="info" variant="tonal" class="mt-4 text-body-2">
              Kuroshiro will download the repository and import the plugin automatically.
            </VAlert>
          </VWindowItem>

          <VWindowItem value="recipe">
            <VTextField
              v-model="recipeId"
              label="TRMNL Recipe id or URL"
              placeholder="150460 or https://trmnl.com/recipes/150460"
              hint="Enter a Recipe's numeric id or its trmnl.com/recipes/... page URL"
              persistent-hint
            />
            <VAlert type="info" variant="tonal" class="mt-4 text-body-2">
              Kuroshiro will download the Recipe from trmnl.com and import it as a Plugin.
            </VAlert>
          </VWindowItem>
        </VWindow>

        <VSelect
          v-model="selectedDeviceId"
          label="Target Device"
          :items="deviceStore.devices"
          item-title="name"
          item-value="id"
          required
          hint="Select which device this plugin will be assigned to"
          persistent-hint
          class="mt-4"
        />
      </VCardText>
      <VDivider />
      <VCardActions class="d-flex justify-space-between">
        <VBtn variant="text" @click="close">
          Cancel
        </VBtn>
        <VBtn
          color="primary"
          variant="tonal"
          :loading="loading"
          :disabled="(!selectedFile && !githubUrl && !recipeId) || !selectedDeviceId"
          @click="importPlugin"
        >
          Import
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
