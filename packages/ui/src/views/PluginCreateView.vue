<script setup lang="ts">
import type { CreatePluginPayload, Plugin } from '../types/plugin'
import { mdiArrowLeft, mdiArrowRight, mdiCheck, mdiEye } from '@mdi/js'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { VAlert, VBtn, VCard, VCardActions, VCardText, VCardTitle, VCol, VContainer, VDivider, VForm, VRow, VSelect, VStepper, VStepperHeader, VStepperItem, VStepperWindow, VStepperWindowItem, VTextarea, VTextField } from 'vuetify/components'
import PluginDataSourcesEditor from '@/components/PluginDataSourcesEditor.vue'
import PluginPreviewDialog from '@/components/PluginPreviewDialog.vue'
import PluginTemplateEditor from '@/components/PluginTemplateEditor.vue'
import { usePluginPreview } from '@/composeables/usePluginPreview'
import { errorMessage } from '@/utils/errorMessage'
import { nameRules, refreshIntervalRules } from '@/utils/pluginRules'
import { routeParam } from '@/utils/routeParam'
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
    if (source.mode === 'literal')
      return source.literalValue !== undefined && source.literalValue !== null
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

const {
  previewLoading,
  previewHtml,
  previewTarget,
  previewData,
  previewError,
  showPreview,
  previewTab,
  previewPlugin,
} = usePluginPreview({
  dataSources: () => pluginData.value.dataSources,
  liquidMarkup: () => pluginData.value.templates?.[0]?.liquidMarkup,
})

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
        mode: source.mode,
        method: source.method,
        url: source.url,
        headers: source.headers,
        body: source.body,
        literalValue: source.literalValue,
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

                    <PluginTemplateEditor v-model="pluginData.templates![0].liquidMarkup" />
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

    <!-- fallow-ignore-next-line code-duplication -- identical wiring of the shared PluginPreviewDialog, not extractable further -->
    <PluginPreviewDialog
      v-model:show="showPreview"
      v-model:tab="previewTab"
      v-model:target="previewTarget"
      :html="previewHtml"
      :data="previewData"
      :error="previewError"
    />
  </VContainer>
</template>
