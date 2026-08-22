<script setup lang="ts">
import type { CreatePluginPayload, Plugin } from '../types/plugin'
import type { RenderTarget } from '@/utils/screenShell'
import { mdiArrowLeft, mdiArrowRight, mdiCheck, mdiEye } from '@mdi/js'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { VAlert, VBtn, VCard, VCardActions, VCardText, VCardTitle, VCol, VContainer, VDialog, VDivider, VExpandTransition, VForm, VRow, VSelect, VSpacer, VStepper, VStepperHeader, VStepperItem, VStepperWindow, VStepperWindowItem, VTab, VTabs, VTextarea, VTextField, VWindow, VWindowItem } from 'vuetify/components'
import PluginDataSourcesEditor from '@/components/PluginDataSourcesEditor.vue'
import RenderTargetPicker from '@/components/RenderTargetPicker.vue'
import ScreenFrame from '@/components/ScreenFrame.vue'
import { errorMessage } from '@/utils/errorMessage'
import { DEFAULT_MODEL, DEFAULT_PALETTE } from '@/utils/renderTarget'
import { routeParam } from '@/utils/routeParam'
import { viewFull } from '@/utils/screenShell'
import { usePluginsStore } from '../stores/plugins'

const route = useRoute()
const router = useRouter()
const pluginsStore = usePluginsStore()

const step = ref(1)
const formRef = ref<null | typeof VForm>(null)

const deviceId = computed(() => routeParam(route.query.deviceId))

const pluginData = ref<Partial<Plugin>>({
  name: '',
  description: '',
  kind: 'Poll',
  refreshInterval: 15,
  dataSources: [],
  templates: [{
    id: '',
    layout: 'full',
    liquidMarkup: '',
  }],
})

const nameRules = [
  (value: string) => {
    if (!value || value.trim() === '') {
      return 'Plugin name is required'
    }
    return true
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
  if (!pluginData.value.refreshInterval || pluginData.value.refreshInterval < 1)
    return false

  const sources = pluginData.value.dataSources || []
  return sources.every((source) => {
    if (!source.name || source.name.trim() === '' || source.name.trim() === 'trmnl')
      return false
    try {
      const _url = new URL(source.url || '')
      return true
    }
    catch {
      return false
    }
  })
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
const saveError = ref('')
const previewLoading = ref(false)
const previewHtml = ref('')
const previewTarget = ref<RenderTarget>({ model: DEFAULT_MODEL, palette: DEFAULT_PALETTE })
const previewData = ref<Record<string, unknown> | null>(null)
const previewError = ref('')
const showPreview = ref(false)
const previewTab = ref('rendered')
const showTemplateHelp = ref(false)

async function previewPlugin() {
  const sources = pluginData.value.dataSources || []
  if (sources.length === 0 || !pluginData.value.templates?.[0]?.liquidMarkup)
    return

  previewLoading.value = true
  try {
    const res = await fetch('/api/plugins/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sources: sources.map(source => ({
          name: source.name,
          url: source.url,
          method: source.method,
          headers: source.headers,
          body: source.body,
        })),
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
  catch (err) {
    console.error('Preview error:', err)
    previewError.value = errorMessage(err, 'Failed to generate preview. Check console for details.')
  }
  finally {
    previewLoading.value = false
  }
}

async function createPlugin() {
  loading.value = true
  saveError.value = ''
  try {
    const sources = pluginData.value.dataSources || []
    const template = pluginData.value.templates?.[0]

    const payload: CreatePluginPayload = {
      name: pluginData.value.name ?? '',
      description: pluginData.value.description,
      kind: pluginData.value.kind ?? 'Poll',
      refreshInterval: pluginData.value.refreshInterval,
      dataSources: sources.map((source, index) => ({
        name: source.name,
        method: source.method,
        url: source.url,
        headers: source.headers,
        body: source.body,
        order: index,
      })),
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
  catch (err) {
    saveError.value = errorMessage(err, 'Failed to create plugin. Check console for details.')
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
                  title="Data Sources"
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
                      v-model.number="pluginData.refreshInterval"
                      label="Refresh Interval (minutes)"
                      type="number"
                      :rules="refreshIntervalRules"
                      required
                      min="1"
                      class="mb-4"
                    />
                    <PluginDataSourcesEditor v-model="pluginData.dataSources!" />
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
                        :disabled="!canProceedStep2 || !(pluginData.dataSources || []).length || !pluginData.templates![0].liquidMarkup"
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
          <VAlert v-if="saveError" type="error" variant="tonal" class="mx-4 mb-4">
            {{ saveError }}
          </VAlert>
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
                <RenderTargetPicker v-model="previewTarget" class="mb-3" />
                <ScreenFrame :body="viewFull(previewHtml)" :target="previewTarget" />
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
