<script setup lang="ts">
import type { Plugin } from '../types/plugin'
import { mdiArrowLeft, mdiContentSave, mdiEye } from '@mdi/js'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { VAlert, VBtn, VCard, VCardActions, VCardText, VCardTitle, VCol, VContainer, VDialog, VDivider, VExpandTransition, VExpansionPanel, VExpansionPanels, VExpansionPanelText, VExpansionPanelTitle, VForm, VProgressCircular, VRow, VSelect, VSpacer, VSwitch, VTab, VTabs, VTextarea, VTextField, VWindow, VWindowItem } from 'vuetify/components'
import { usePluginsStore } from '../stores/plugins'

const props = defineProps<{
  id: string
}>()

const router = useRouter()
const pluginsStore = usePluginsStore()

const plugin = ref<Plugin | null>(null)
const formRef = ref<null | typeof VForm>(null)

const nameRules = [
  (value: string) => {
    if (!value || value.trim() === '') {
      return 'Plugin name is required'
    }
    return true
  },
]

const urlRules = [
  (value: string) => {
    if (!value || value.trim() === '') {
      return 'Data source URL is required'
    }
    try {
      const _url = new URL(value)
      return true
    }
    catch {
      return 'Enter a valid URL'
    }
  },
]

const templateRules = [
  (value: string) => {
    if (!value || value.trim() === '') {
      return 'Liquid template is required'
    }
    return true
  },
]

const refreshIntervalRules = [
  (value: number) => {
    if (value < 1) {
      return 'Refresh interval must be at least 1 minute'
    }
    return true
  },
]

const headersJson = ref('')
const fieldValues = ref<Record<string, string>>({})
const showTemplateHelp = ref(false)

const configurableFields = computed(() => {
  if (!plugin.value?.fields)
    return []
  return plugin.value.fields.filter(field => field.fieldType !== 'author_bio')
})

onMounted(async () => {
  try {
    const res = await fetch(`/api/plugins/${props.id}`)
    if (!res.ok)
      throw new Error('Failed to fetch plugin')
    plugin.value = await res.json()
    if (plugin.value?.dataSource?.headers) {
      headersJson.value = JSON.stringify(plugin.value.dataSource.headers, null, 2)
    }
    // Initialize field values from plugin fields
    if (plugin.value?.fields) {
      plugin.value.fields.forEach((field) => {
        fieldValues.value[field.keyname] = field.defaultValue || ''
      })
    }
  }
  catch (err) {
    console.error(err)
    router.push({ name: 'overview' })
  }
})

const loading = ref(false)
const previewLoading = ref(false)
const previewHtml = ref('')
const previewData = ref<any>(null)
const previewError = ref('')
const showPreview = ref(false)
const previewTab = ref('rendered')

async function savePlugin() {
  if (!plugin.value)
    return

  loading.value = true
  try {
    let headers = {}
    if (headersJson.value && headersJson.value.trim()) {
      try {
        headers = JSON.parse(headersJson.value)
      }
      catch {
        headers = {}
      }
    }

    if (plugin.value.dataSource) {
      plugin.value.dataSource.headers = headers
    }

    await pluginsStore.updatePlugin(props.id, plugin.value)
    router.push({ name: 'pluginsOverview' })
  }
  finally {
    loading.value = false
  }
}

async function previewPlugin() {
  if (!plugin.value?.dataSource || !plugin.value?.templates?.[0])
    return

  previewLoading.value = true
  try {
    let headers = {}
    if (headersJson.value && headersJson.value.trim()) {
      try {
        headers = JSON.parse(headersJson.value)
      }
      catch {
        headers = {}
      }
    }

    const res = await fetch('/api/plugins/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: plugin.value.dataSource.url,
        method: plugin.value.dataSource.method,
        headers,
        body: plugin.value.dataSource.body,
        template: plugin.value.templates[0].liquidMarkup,
        transformJs: plugin.value.dataSource.transformJs,
        fieldValues: fieldValues.value,
      }),
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      const errorMsg = errorData.message || await res.text() || 'Unknown error'

      if (res.status === 403) {
        throw new Error('API returned 403 (authentication required). The data source may require API keys or authentication headers.')
      }
      else if (res.status === 404) {
        throw new Error('API endpoint not found (404). Check the data source URL.')
      }
      else if (res.status >= 500) {
        throw new Error(`API server error (${res.status}). The data source may be unavailable.`)
      }
      else {
        throw new Error(`Preview failed: ${errorMsg}`)
      }
    }

    const result = await res.json()
    previewHtml.value = result.html
    previewData.value = result.data
    previewError.value = ''
    showPreview.value = true
  }
  catch (err: any) {
    console.error('Preview error:', err)
    previewError.value = err.message || 'Failed to generate preview. Check console for details.'
  }
  finally {
    previewLoading.value = false
  }
}

function cancel() {
  router.push({ name: 'pluginsOverview' })
}
</script>

<template>
  <VContainer fluid>
    <VRow justify="center">
      <VCol cols="12" lg="8">
        <VCard v-if="plugin" elevation="1">
          <VCardTitle>
            Edit Plugin
          </VCardTitle>
          <VDivider />
          <VCardText>
            <VForm ref="formRef">
              <div class="mb-6">
                <h3 class="text-h6 mb-3">
                  Basic Info
                </h3>
                <VTextField
                  v-model="plugin.name"
                  label="Plugin Name"
                  :rules="nameRules"
                  required
                />
                <VTextarea
                  v-model="plugin.description"
                  label="Description"
                  rows="3"
                />
              </div>

              <VDivider class="my-6" />

              <VExpansionPanels class="mb-6">
                <VExpansionPanel v-if="plugin.dataSource">
                  <VExpansionPanelTitle>
                    <h3 class="text-h6">
                      Data Source
                    </h3>
                  </VExpansionPanelTitle>
                  <VExpansionPanelText>
                    <VTextField
                      v-model="plugin.dataSource.url"
                      label="Data Source URL"
                      :rules="urlRules"
                      required
                      placeholder="https://api.example.com/data"
                      class="mt-4"
                    />
                    <VSelect
                      v-model="plugin.dataSource.method"
                      label="HTTP Method"
                      :items="['GET', 'POST']"
                    />
                    <VTextField
                      v-model.number="plugin.refreshInterval"
                      label="Refresh Interval (minutes)"
                      type="number"
                      :rules="refreshIntervalRules"
                      required
                      min="1"
                    />
                    <VTextarea
                      v-model="headersJson"
                      label="Request Headers (JSON)"
                      rows="3"
                      placeholder="{&quot;Authorization&quot;: &quot;Bearer token&quot;}"
                      hint="Optional: Enter valid JSON for custom headers"
                    />
                  </VExpansionPanelText>
                </VExpansionPanel>

                <VExpansionPanel v-if="configurableFields.length > 0">
                  <VExpansionPanelTitle>
                    <h3 class="text-h6">
                      Plugin Configuration
                    </h3>
                  </VExpansionPanelTitle>
                  <VExpansionPanelText>
                    <div v-for="field in configurableFields" :key="field.id" class="mb-4 mt-4">
                      <VTextField
                        v-if="field.fieldType === 'string' || field.fieldType === 'url'"
                        v-model="fieldValues[field.keyname]"
                        :label="field.name"
                        :hint="field.description"
                        :placeholder="field.defaultValue"
                        :required="field.required"
                        persistent-hint
                      />
                      <VTextField
                        v-else-if="field.fieldType === 'password'"
                        v-model="fieldValues[field.keyname]"
                        :label="field.name"
                        :hint="field.description"
                        :placeholder="field.defaultValue"
                        :required="field.required"
                        type="password"
                        persistent-hint
                      />
                      <VSwitch
                        v-else-if="field.fieldType === 'boolean'"
                        v-model="fieldValues[field.keyname]"
                        :label="field.name"
                        :hint="field.description"
                        persistent-hint
                      />
                      <VTextField
                        v-else
                        v-model="fieldValues[field.keyname]"
                        :label="field.name"
                        :hint="field.description"
                        :placeholder="field.defaultValue"
                        :required="field.required"
                        persistent-hint
                      />
                    </div>
                  </VExpansionPanelText>
                </VExpansionPanel>
              </VExpansionPanels>

              <div v-if="plugin.templates && plugin.templates.length > 0" class="mb-6">
                <div class="d-flex align-center justify-space-between mb-3">
                  <h3 class="text-h6">
                    Template
                  </h3>
                  <VBtn
                    variant="tonal"
                    color="secondary"
                    size="small"
                    :prepend-icon="mdiEye"
                    :loading="previewLoading"
                    @click="previewPlugin"
                  >
                    Preview
                  </VBtn>
                </div>
                <VAlert type="info" variant="tonal" class="mb-3 text-body-2">
                  Layout options will be available when plugin mashups are supported.
                </VAlert>

                <div class="mb-3">
                  <VBtn
                    variant="text"
                    size="small"
                    @click="showTemplateHelp = !showTemplateHelp"
                  >
                    {{ showTemplateHelp ? 'Hide' : 'Show' }} Template Help
                  </VBtn>
                </div>

                <VExpandTransition>
                  <VCard v-show="showTemplateHelp" variant="tonal" class="mb-3">
                    <VCardText class="text-body-2">
                      <div class="mb-3">
                        <strong>Liquid Template Syntax</strong>
                      </div>
                      <div class="mb-2">
                        <code class="text-caption" v-text="'{{ variable }}'" /> — Display a variable
                      </div>
                      <div class="mb-2">
                        <code class="text-caption" v-text="'{% if condition %}...{% endif %}'" /> — Conditional logic
                      </div>
                      <div class="mb-2">
                        <code class="text-caption" v-text="'{% for item in items %}...{% endfor %}'" /> — Loop through array
                      </div>
                      <div class="mb-2">
                        <code class="text-caption" v-text="'{{ date | date_short }}'" /> — Format with filters
                      </div>
                      <div class="mt-3">
                        <strong>Available Filters:</strong>
                        <code class="text-caption d-block mt-1">date_short, date_long, time_short, number_with_delimiter, round, truncate_words, titleize, url_encode</code>
                      </div>
                      <div class="mt-3 text-medium-emphasis">
                        <a href="https://liquidjs.com/tutorials/intro-to-liquid.html" target="_blank" class="text-decoration-none">
                          Learn more about Liquid syntax →
                        </a>
                      </div>
                    </VCardText>
                  </VCard>
                </VExpandTransition>

                <VTextarea
                  v-model="plugin.templates[0].liquidMarkup"
                  label="Liquid Template"
                  :rules="templateRules"
                  required
                  rows="15"
                  placeholder="<div>{{ data.title }}</div>"
                  hint="Use Liquid syntax to render data from the API"
                />
              </div>
            </VForm>
          </VCardText>
          <VDivider />
          <VCardActions class="d-flex justify-space-between pa-4">
            <VBtn
              variant="text"
              :prepend-icon="mdiArrowLeft"
              @click="cancel"
            >
              Back
            </VBtn>
            <VBtn
              variant="tonal"
              color="primary"
              :prepend-icon="mdiContentSave"
              :loading="loading"
              @click="savePlugin"
            >
              Save Changes
            </VBtn>
          </VCardActions>
        </VCard>
        <VCard v-else elevation="1">
          <VCardText class="text-center py-8">
            <VProgressCircular indeterminate color="primary" />
            <div class="mt-4 text-medium-emphasis">
              Loading plugin...
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VDialog v-model="showPreview" max-width="900px">
      <VCard>
        <VCardTitle>
          <span class="text-h6">Plugin Preview</span>
        </VCardTitle>
        <VDivider />
        <VCardText>
          <VAlert v-if="previewError" type="error" class="mb-4">
            {{ previewError }}
          </VAlert>
          <VTabs v-model="previewTab">
            <VTab value="rendered">
              Rendered Output
            </VTab>
            <VTab value="data">
              Fetched Data
            </VTab>
          </VTabs>
          <VWindow v-model="previewTab">
            <VWindowItem value="rendered">
              <div v-if="previewHtml" class="mt-4">
                <iframe
                  :srcdoc="previewHtml"
                  width="800"
                  height="480"
                  style="border: 1px solid #ccc;"
                />
              </div>
            </VWindowItem>
            <VWindowItem value="data">
              <pre class="mt-4 pa-4" style="background: #f5f5f5; color: #1a1a1a; border-radius: 4px; overflow: auto; max-height: 400px;">{{ JSON.stringify(previewData, null, 2) }}</pre>
            </VWindowItem>
          </VWindow>
        </VCardText>
        <VDivider />
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="showPreview = false">
            Close
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </VContainer>
</template>
