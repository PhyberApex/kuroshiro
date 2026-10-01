<script setup lang="ts">
import type { Plugin } from '../types/plugin'
import type { RecipeUpdatePreview, UpdateItem, UpdateItemType } from '../types/recipeUpdate'
import { computed, ref, watch } from 'vue'
import { VAlert, VBtn, VCard, VCardActions, VCardText, VCardTitle, VDialog, VDivider, VExpansionPanels, VSpacer } from 'vuetify/components'
import { RecipeUpdateConflictError, usePluginsStore } from '../stores/plugins'
import { updateItemKey } from '../types/recipeUpdate'
import { errorMessage } from '../utils/errorMessage'
import RecipeUpdateItemPanel from './RecipeUpdateItemPanel.vue'

const props = defineProps<{
  modelValue: boolean
  plugin: Plugin
  preview: RecipeUpdatePreview | null
  error: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'applied': []
}>()

const pluginsStore = usePluginsStore()

const SECTIONS: Array<{ label: string, types: UpdateItemType[] }> = [
  { label: 'Plugin details', types: ['name', 'description', 'refreshInterval'] },
  { label: 'Templates', types: ['template'] },
  { label: 'Data Sources', types: ['dataSource'] },
  { label: 'Fields', types: ['field'] },
]

const currentPreview = ref<RecipeUpdatePreview | null>(null)
const currentError = ref<string | null>(null)
const checking = ref(false)
const applying = ref(false)
const applyConflict = ref(false)
const selected = ref<Set<string>>(new Set())

watch(() => props.modelValue, (open) => {
  if (!open)
    return
  currentPreview.value = props.preview
  currentError.value = props.error
  applyConflict.value = false
  resetSelection()
}, { immediate: true })

function resetSelection() {
  const preview = currentPreview.value
  if (!preview || preview.mode === 'two-way') {
    selected.value = new Set()
    return
  }
  selected.value = new Set(preview.items.filter(item => !item.conflict).map(updateItemKey))
}

function isSelected(item: UpdateItem): boolean {
  return selected.value.has(updateItemKey(item))
}

function toggle(item: UpdateItem) {
  const next = new Set(selected.value)
  const key = updateItemKey(item)
  if (next.has(key))
    next.delete(key)
  else
    next.add(key)
  selected.value = next
}

const sections = computed(() => {
  const preview = currentPreview.value
  if (!preview)
    return []
  return SECTIONS
    .map(section => ({ label: section.label, items: preview.items.filter(item => section.types.includes(item.itemType)) }))
    .filter(section => section.items.length > 0)
})

const isUpToDate = computed(() => currentPreview.value !== null && currentPreview.value.items.length === 0)
const hasSelection = computed(() => selected.value.size > 0)
const canSaveBaseline = computed(() => currentPreview.value?.mode === 'two-way')
const showApplyButton = computed(() => !currentError.value && !applyConflict.value && currentPreview.value !== null && (currentPreview.value.items.length > 0 || canSaveBaseline.value))
const applyButtonLabel = computed(() => hasSelection.value ? 'Apply selected' : 'Save baseline')
const showTwoWayBanner = computed(() => currentPreview.value?.mode === 'two-way')

function missingAssignmentsFor(item: UpdateItem) {
  if (item.itemType !== 'field')
    return undefined
  return currentPreview.value?.assignmentsMissingRequiredField.find(entry => entry.key === item.key)
}

async function apply() {
  const preview = currentPreview.value
  if (!preview)
    return

  applying.value = true
  applyConflict.value = false
  try {
    const apply = preview.items
      .filter(item => selected.value.has(updateItemKey(item)))
      .map(item => ({ itemType: item.itemType, key: item.key }))

    await pluginsStore.applyRecipeUpdate(props.plugin.id, { contentHash: preview.contentHash, apply })
    emit('applied')
    close()
  }
  catch (err) {
    if (err instanceof RecipeUpdateConflictError) {
      applyConflict.value = true
    }
    else {
      currentError.value = errorMessage(err, 'Failed to apply Recipe update')
    }
  }
  finally {
    applying.value = false
  }
}

async function checkAgain() {
  checking.value = true
  try {
    currentPreview.value = await pluginsStore.checkRecipeUpdate(props.plugin.id)
    currentError.value = null
    applyConflict.value = false
    resetSelection()
  }
  catch (err) {
    currentError.value = errorMessage(err, 'Failed to check for Recipe updates')
  }
  finally {
    checking.value = false
  }
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <VDialog :model-value="modelValue" max-width="800" @update:model-value="emit('update:modelValue', $event)">
    <VCard>
      <VCardTitle>Check for Recipe Updates</VCardTitle>
      <VDivider />
      <VCardText>
        <VAlert v-if="currentError" type="error" variant="tonal" data-test-id="recipe-update-error">
          {{ currentError }}
        </VAlert>

        <VAlert v-else-if="applyConflict" type="error" variant="tonal" data-test-id="recipe-update-conflict">
          The Recipe changed since you previewed.
          <template #append>
            <VBtn variant="text" size="small" :loading="checking" data-test-id="check-again" @click="checkAgain">
              Check again
            </VBtn>
          </template>
        </VAlert>

        <template v-else-if="currentPreview">
          <VAlert v-if="showTwoWayBanner" type="info" variant="tonal" class="mb-4" data-test-id="recipe-update-two-way-banner">
            This Plugin has no Recipe Snapshot, so differences may be your own edits.
          </VAlert>

          <div v-if="isUpToDate" data-test-id="recipe-update-up-to-date">
            Up to date
          </div>

          <div v-for="section in sections" :key="section.label" class="mb-4">
            <div class="text-subtitle-2 mb-1">
              {{ section.label }}
            </div>
            <VExpansionPanels variant="accordion">
              <RecipeUpdateItemPanel
                v-for="item in section.items"
                :key="updateItemKey(item)"
                :item="item"
                :selected="isSelected(item)"
                :missing-assignment="missingAssignmentsFor(item)"
                @toggle="toggle(item)"
              />
            </VExpansionPanels>
          </div>
        </template>
      </VCardText>
      <VDivider />
      <VCardActions>
        <VSpacer />
        <VBtn variant="text" data-test-id="recipe-update-close" @click="close">
          {{ currentError ? 'Close' : 'Dismiss' }}
        </VBtn>
        <VBtn
          v-if="showApplyButton"
          color="primary"
          variant="tonal"
          :loading="applying"
          data-test-id="recipe-update-apply"
          @click="apply"
        >
          {{ applyButtonLabel }}
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
