<script setup lang="ts">
import type { PluginDataSource } from '@/types/plugin'
import { mdiDelete, mdiPlus } from '@mdi/js'
import { VAlert, VBtn, VExpansionPanel, VExpansionPanels, VExpansionPanelText, VExpansionPanelTitle, VSelect, VTextarea, VTextField } from 'vuetify/components'

export type EditableDataSource = Partial<PluginDataSource> & { headersJson?: string }

const dataSources = defineModel<EditableDataSource[]>({ required: true })

const nameRules = [
  (value: string) => {
    if (!value || value.trim() === '')
      return 'Name is required'
    if (value.trim() === 'trmnl')
      return '"trmnl" is a reserved name'
    return true
  },
]

function nameRulesFor(index: number) {
  return [
    ...nameRules,
    (value: string) => {
      const name = value?.trim()
      if (!name)
        return true
      const isDuplicate = dataSources.value.some((source, i) => i !== index && source.name?.trim() === name)
      return isDuplicate ? `"${name}" is already used by another data source` : true
    },
  ]
}

const urlRules = [
  (value: string) => {
    if (!value || value.trim() === '')
      return 'URL is required'
    try {
      const _url = new URL(value)
      return true
    }
    catch {
      return 'Enter a valid URL'
    }
  },
]

function addDataSource() {
  dataSources.value = [
    ...dataSources.value,
    { name: '', method: 'GET', url: '', headers: {}, body: {}, headersJson: '', order: dataSources.value.length },
  ]
}

function removeDataSource(index: number) {
  dataSources.value = dataSources.value.filter((_, i) => i !== index)
}

function syncHeaders(source: EditableDataSource) {
  if (!source.headersJson || !source.headersJson.trim()) {
    source.headers = {}
    return
  }
  try {
    source.headers = JSON.parse(source.headersJson)
  }
  catch {
    // Leave the last valid headers in place until the JSON becomes valid again
  }
}
</script>

<template>
  <div>
    <VAlert v-if="dataSources.length === 0" type="info" variant="tonal" class="mb-4">
      No data sources yet. A Poll-kind plugin can be saved without one as a draft, but it won't fetch or render anything until you add at least one.
    </VAlert>

    <VExpansionPanels v-if="dataSources.length > 0" class="mb-4" multiple>
      <VExpansionPanel v-for="(source, index) in dataSources" :key="index">
        <VExpansionPanelTitle>
          {{ source.name || `Data Source ${index + 1}` }}
        </VExpansionPanelTitle>
        <VExpansionPanelText>
          <VTextField
            v-model="source.name"
            label="Name"
            :rules="nameRulesFor(index)"
            hint="Used in your template as {{ name.field }}"
            persistent-hint
            required
            class="mt-2"
          />
          <VTextField
            v-model="source.url"
            label="URL"
            :rules="urlRules"
            required
            placeholder="https://api.example.com/data"
            class="mt-4"
          />
          <VSelect
            v-model="source.method"
            label="HTTP Method"
            :items="['GET', 'POST']"
          />
          <VTextarea
            v-model="source.headersJson"
            label="Request Headers (JSON)"
            rows="3"
            placeholder="{&quot;Authorization&quot;: &quot;Bearer token&quot;}"
            hint="Optional: Enter valid JSON for custom headers"
            @update:model-value="syncHeaders(source)"
          />
          <VBtn
            variant="text"
            size="small"
            color="error"
            :prepend-icon="mdiDelete"
            @click="removeDataSource(index)"
          >
            Remove Data Source
          </VBtn>
        </VExpansionPanelText>
      </VExpansionPanel>
    </VExpansionPanels>

    <VBtn variant="tonal" :prepend-icon="mdiPlus" @click="addDataSource">
      Add Data Source
    </VBtn>
  </div>
</template>
