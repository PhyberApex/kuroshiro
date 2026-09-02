<script setup lang="ts">
import type { CreatePluginDataSourcePayload, Plugin } from '../types/plugin'
import type { EditableDataSource } from '@/components/PluginDataSourcesEditor.vue'
import { mdiArrowLeft, mdiContentSave, mdiEye } from '@mdi/js'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { VAlert, VBtn, VCard, VCardActions, VCardText, VCardTitle, VCol, VContainer, VDivider, VExpansionPanel, VExpansionPanels, VExpansionPanelText, VExpansionPanelTitle, VForm, VProgressCircular, VRow, VSwitch, VTextarea, VTextField } from 'vuetify/components'
import PluginDataSourcesEditor from '@/components/PluginDataSourcesEditor.vue'
import PluginPreviewDialog from '@/components/PluginPreviewDialog.vue'
import PluginTemplateEditor from '@/components/PluginTemplateEditor.vue'
import { usePluginPreview } from '@/composeables/usePluginPreview'
import { apiFetch } from '@/utils/apiRequest'
import { errorMessage } from '@/utils/errorMessage'
import { nameRules, refreshIntervalRules } from '@/utils/pluginRules'
import { usePluginsStore } from '../stores/plugins'

const props = defineProps<{
  id: string
}>()

const router = useRouter()
const pluginsStore = usePluginsStore()

type EditablePlugin = Omit<Plugin, 'dataSources'> & { dataSources?: EditableDataSource[] }

const plugin = ref<EditablePlugin | null>(null)
const formRef = ref<null | typeof VForm>(null)

const fieldValues = ref<Record<string, string>>({})

const configurableFields = computed(() => {
  if (!plugin.value?.fields)
    return []
  return plugin.value.fields.filter(field => field.fieldType !== 'author_bio')
})

onMounted(async () => {
  try {
    const res = await apiFetch(`/api/plugins/${props.id}`)
    if (!res.ok)
      throw new Error('Failed to fetch plugin')
    plugin.value = await res.json()
    if (plugin.value) {
      plugin.value.dataSources = (plugin.value.dataSources ?? []).map(source => ({
        ...source,
        headersJson: source.headers ? JSON.stringify(source.headers, null, 2) : '',
        literalValueJson: source.literalValue !== undefined ? JSON.stringify(source.literalValue, null, 2) : '',
      }))
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
  dataSources: () => plugin.value?.dataSources,
  liquidMarkup: () => plugin.value?.templates?.[0]?.liquidMarkup,
  fieldValues: () => fieldValues.value,
})

async function savePlugin() {
  if (!plugin.value)
    return

  loading.value = true
  saveError.value = ''
  try {
    // Re-derive order from the current array position: entries added/removed
    // in the editor may carry stale or colliding order values.
    const payload = {
      ...plugin.value,
      dataSources: (plugin.value.dataSources || []).map((source, index): CreatePluginDataSourcePayload => ({
        name: source.name ?? '',
        mode: source.mode,
        method: source.method,
        url: source.url,
        headers: source.headers,
        body: source.body,
        transformJs: source.transformJs,
        literalValue: source.literalValue,
        order: index,
      })),
    }
    await pluginsStore.updatePlugin(props.id, payload)
    router.push({ name: 'pluginsOverview' })
  }
  catch (err) {
    saveError.value = errorMessage(err, 'Failed to save plugin. Check console for details.')
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

              <div class="mb-6">
                <h3 class="text-h6 mb-3">
                  Data Sources
                </h3>
                <VTextField
                  v-model.number="plugin.refreshInterval"
                  label="Refresh Interval (minutes)"
                  type="number"
                  :rules="refreshIntervalRules"
                  required
                  min="1"
                  class="mb-4"
                />
                <PluginDataSourcesEditor v-model="plugin.dataSources!" />
              </div>

              <VDivider class="my-6" />

              <VExpansionPanels class="mb-6">
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

                <PluginTemplateEditor v-model="plugin.templates[0].liquidMarkup" />
              </div>
            </VForm>
          </VCardText>
          <VAlert v-if="saveError" type="error" variant="tonal" class="mx-4 mb-4">
            {{ saveError }}
          </VAlert>
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
