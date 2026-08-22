<script setup lang="ts">
import type { PluginDataSource } from '@/types/plugin'
import { mdiDelete, mdiPlus } from '@mdi/js'
import { VAlert, VBtn, VExpansionPanel, VExpansionPanels, VExpansionPanelText, VExpansionPanelTitle, VSelect, VTextarea, VTextField } from 'vuetify/components'

export type EditableDataSource = Partial<PluginDataSource> & { headersJson?: string, literalValueJson?: string }

const dataSources = defineModel<EditableDataSource[]>({ required: true })

const modeOptions = [
  { title: 'Fetch (HTTP request)', value: 'fetch' },
  { title: 'Literal (fixed value)', value: 'literal' },
]

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

const literalValueRules = [
  (value: string) => {
    if (!value || !value.trim())
      return 'Value is required'
    try {
      JSON.parse(value)
      return true
    }
    catch {
      return 'Enter valid JSON'
    }
  },
]

function addDataSource() {
  dataSources.value = [
    ...dataSources.value,
    { name: '', mode: 'fetch', method: 'GET', url: '', headers: {}, body: {}, headersJson: '', order: dataSources.value.length },
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

function syncLiteralValue(source: EditableDataSource) {
  if (!source.literalValueJson || !source.literalValueJson.trim()) {
    source.literalValue = undefined
    return
  }
  try {
    source.literalValue = JSON.parse(source.literalValueJson)
  }
  catch {
    // Leave the last valid value in place until the JSON becomes valid again
  }
}

function onModeChange(source: EditableDataSource) {
  if (source.mode === 'literal') {
    source.method = undefined
    source.url = undefined
    source.headers = undefined
    source.body = undefined
    source.transformJs = undefined
    source.headersJson = ''
  }
  else {
    source.method = source.method || 'GET'
    source.literalValue = undefined
    source.literalValueJson = ''
  }
}

defineExpose({
  dataSources,
  addDataSource,
  removeDataSource,
  syncLiteralValue,
  onModeChange,
})
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
          <VSelect
            v-model="source.mode"
            label="Data Source Mode"
            :items="modeOptions"
            item-title="title"
            item-value="value"
            hint="Fetch makes an HTTP request; Literal is a fixed value you type in"
            persistent-hint
            class="mt-4"
            @update:model-value="onModeChange(source)"
          />

          <template v-if="source.mode === 'literal'">
            <VTextarea
              v-model="source.literalValueJson"
              label="Value (JSON)"
              :rules="literalValueRules"
              required
              rows="5"
              placeholder="{&quot;title&quot;: &quot;Hello&quot;}"
              hint="Used in your template as {{ name.field }} — any JSON value"
              persistent-hint
              class="mt-4"
              @update:model-value="syncLiteralValue(source)"
            />
          </template>
          <template v-else>
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
          </template>

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
