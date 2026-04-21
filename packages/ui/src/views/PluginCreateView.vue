<script setup lang="ts">
import type { Plugin } from '../types/plugin'
import { mdiArrowLeft, mdiArrowRight, mdiCheck, mdiEye } from '@mdi/js'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { VAlert, VBtn, VCard, VCardActions, VCardText, VCardTitle, VCol, VContainer, VDialog, VDivider, VExpandTransition, VForm, VRow, VSelect, VSpacer, VStepper, VStepperHeader, VStepperItem, VStepperWindow, VStepperWindowItem, VTab, VTabs, VTextarea, VTextField, VWindow, VWindowItem } from 'vuetify/components'
import { usePluginsStore } from '../stores/plugins'

const route = useRoute()
const router = useRouter()
const pluginsStore = usePluginsStore()

const step = ref(1)
const formRef = ref<null | typeof VForm>(null)

const deviceId = computed(() => route.query.deviceId as string | undefined)

const pluginData = ref<Partial<Plugin>>({
  name: '',
  description: '',
  kind: 'Poll',
  refreshInterval: 15,
  dataSource: {
    id: '',
    method: 'GET',
    url: '',
    headers: {},
    body: {},
  },
  templates: [{
    id: '',
    layout: 'full',
    liquidMarkup: '',
  }],
})

const headersJson = ref('')

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

const canProceedStep1 = computed(() => {
  return pluginData.value.name && pluginData.value.name.trim() !== ''
})

const canProceedStep2 = computed(() => {
  const url = pluginData.value.dataSource?.url || ''
  try {
    const _url = new URL(url)
    return url.trim() !== '' && pluginData.value.refreshInterval && pluginData.value.refreshInterval >= 1
  }
  catch {
    return false
  }
})

const canProceedStep3 = computed(() => {
  const markup = pluginData.value.templates?.[0]?.liquidMarkup || ''
  return markup.trim() !== ''
})

function nextStep() {
  if (step.value < 3) {
    step.value++
  }
}

function prevStep() {
  if (step.value > 1) {
    step.value--
  }
}

const loading = ref(false)
const previewLoading = ref(false)
const previewHtml = ref('')
const previewData = ref<any>(null)
const previewError = ref('')
const showPreview = ref(false)
const previewTab = ref('rendered')
const showTemplateHelp = ref(false)

async function previewPlugin() {
  if (!pluginData.value.dataSource?.url || !pluginData.value.templates?.[0]?.liquidMarkup)
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
        url: pluginData.value.dataSource.url,
        method: pluginData.value.dataSource.method,
        headers,
        body: pluginData.value.dataSource.body,
        template: pluginData.value.templates[0].liquidMarkup,
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

async function createPlugin() {
  loading.value = true
  try {
    const dataSource = pluginData.value.dataSource
    const template = pluginData.value.templates?.[0]

    let headers = {}
    if (headersJson.value && headersJson.value.trim()) {
      try {
        headers = JSON.parse(headersJson.value)
      }
      catch {
        headers = {}
      }
    }

    const payload: any = {
      name: pluginData.value.name,
      description: pluginData.value.description,
      kind: pluginData.value.kind,
      refreshInterval: pluginData.value.refreshInterval,
      dataSource: dataSource
        ? {
            method: dataSource.method,
            url: dataSource.url,
            headers,
            body: dataSource.body,
          }
        : undefined,
      templates: template
        ? [{
            layout: template.layout,
            liquidMarkup: template.liquidMarkup,
          }]
        : undefined,
    }
    const newPlugin = await pluginsStore.createPlugin(payload)

    // If coming from device page, auto-assign to that device
    if (deviceId.value) {
      await pluginsStore.assignToDevice(newPlugin.id, deviceId.value)
      router.push({ name: 'plugins', params: { deviceId: deviceId.value } })
    }
    else {
      router.push({ name: 'pluginsOverview' })
    }
  }
  finally {
    loading.value = false
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
        <VCard elevation="1">
          <VCardTitle>
            Create New Plugin
          </VCardTitle>
          <VDivider />
          <VCardText>
            <VStepper v-model="step" alt-labels>
              <VStepperHeader>
                <VStepperItem
                  :complete="step > 1"
                  :value="1"
                  title="Basic Info"
                />
                <VDivider />
                <VStepperItem
                  :complete="step > 2"
                  :value="2"
                  title="Data Source"
                />
                <VDivider />
                <VStepperItem
                  :complete="step > 3"
                  :value="3"
                  title="Template"
                />
              </VStepperHeader>

              <VStepperWindow>
                <VStepperWindowItem :value="1">
                  <VForm ref="formRef">
                    <VAlert v-if="deviceId" type="info" variant="tonal" class="mb-4">
                      This plugin will be automatically assigned to the selected device after creation.
                    </VAlert>
                    <VTextField
                      v-model="pluginData.name"
                      label="Plugin Name"
                      :rules="nameRules"
                      required
                    />
                    <VTextarea
                      v-model="pluginData.description"
                      label="Description"
                      rows="3"
                    />
                    <VSelect
                      v-model="pluginData.kind"
                      label="Plugin Type"
                      :items="['Poll']"
                      disabled
                    />
                  </VForm>
                </VStepperWindowItem>

                <VStepperWindowItem :value="2">
                  <VForm ref="formRef">
                    <VTextField
                      v-model="pluginData.dataSource!.url"
                      label="Data Source URL"
                      :rules="urlRules"
                      required
                      placeholder="https://api.example.com/data"
                    />
                    <VSelect
                      v-model="pluginData.dataSource!.method"
                      label="HTTP Method"
                      :items="['GET', 'POST']"
                    />
                    <VTextField
                      v-model.number="pluginData.refreshInterval"
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
                  </VForm>
                </VStepperWindowItem>

                <VStepperWindowItem :value="3">
                  <VForm ref="formRef">
                    <div class="d-flex align-center justify-space-between mb-3">
                      <span class="text-subtitle-1">Template Configuration</span>
                      <VBtn
                        variant="tonal"
                        color="secondary"
                        size="small"
                        :prepend-icon="mdiEye"
                        :loading="previewLoading"
                        :disabled="!canProceedStep2 || !pluginData.templates![0].liquidMarkup"
                        @click="previewPlugin"
                      >
                        Preview
                      </VBtn>
                    </div>

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
                      v-model="pluginData.templates![0].liquidMarkup"
                      label="Liquid Template"
                      :rules="templateRules"
                      required
                      rows="15"
                      placeholder="<div>{{ data.title }}</div>"
                      hint="Use Liquid syntax to render data from the API"
                    />
                  </VForm>
                </VStepperWindowItem>
              </VStepperWindow>
            </VStepper>
          </VCardText>
          <VDivider />
          <VCardActions class="d-flex justify-space-between pa-4">
            <VBtn
              variant="text"
              @click="cancel"
            >
              Cancel
            </VBtn>
            <div class="d-flex ga-2">
              <VBtn
                v-if="step > 1"
                variant="tonal"
                :prepend-icon="mdiArrowLeft"
                @click="prevStep"
              >
                Back
              </VBtn>
              <VBtn
                v-if="step < 3"
                variant="tonal"
                color="primary"
                :append-icon="mdiArrowRight"
                :disabled="(step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2)"
                @click="nextStep"
              >
                Next
              </VBtn>
              <VBtn
                v-else
                variant="tonal"
                color="success"
                :prepend-icon="mdiCheck"
                :disabled="!canProceedStep3"
                :loading="loading"
                @click="createPlugin"
              >
                Create Plugin
              </VBtn>
            </div>
          </VCardActions>
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
