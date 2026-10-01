<script setup lang="ts">
import type { AssignmentsMissingRequiredField, NormalizedDataSource, NormalizedField, NormalizedTemplate, UpdateItem } from '../types/recipeUpdate'
import { VAlert, VCheckbox, VChip, VExpansionPanel, VExpansionPanelText, VExpansionPanelTitle } from 'vuetify/components'
import { updateItemKey } from '../types/recipeUpdate'
import RecipeUpdateLineDiff from './RecipeUpdateLineDiff.vue'
import RecipeUpdatePropertyTable from './RecipeUpdatePropertyTable.vue'

defineProps<{
  item: UpdateItem
  selected: boolean
  missingAssignment?: AssignmentsMissingRequiredField
}>()

defineEmits<{
  toggle: []
}>()

const FIELD_PROPERTIES = ['fieldType', 'name', 'description', 'defaultValue', 'required', 'order'] as const

function kindColor(kind: UpdateItem['kind']): string {
  if (kind === 'added')
    return 'success'
  if (kind === 'removed')
    return 'error'
  return 'info'
}

function propertyRowsFor(item: UpdateItem): Array<{ label: string, before: unknown, after: unknown }> {
  if (item.itemType === 'field') {
    const local = item.local as NormalizedField | undefined
    const upstream = item.upstream as NormalizedField | undefined
    return FIELD_PROPERTIES.map(key => ({ label: key, before: local?.[key], after: upstream?.[key] }))
  }
  if (item.itemType === 'dataSource') {
    const local = item.local as NormalizedDataSource | undefined
    const upstream = item.upstream as NormalizedDataSource | undefined
    const mode = local?.mode ?? upstream?.mode
    const keys = mode === 'literal' ? (['mode', 'literalValue'] as const) : (['mode', 'method', 'url', 'headers'] as const)
    return keys.map(key => ({ label: key, before: local?.[key], after: upstream?.[key] }))
  }
  return [{ label: 'value', before: item.local, after: item.upstream }]
}

function isFetchDataSource(item: UpdateItem): boolean {
  if (item.itemType !== 'dataSource')
    return false
  const local = item.local as NormalizedDataSource | undefined
  const upstream = item.upstream as NormalizedDataSource | undefined
  return (local?.mode ?? upstream?.mode) === 'fetch'
}

function liquidMarkupOf(value: unknown): string {
  return (value as NormalizedTemplate | undefined)?.liquidMarkup ?? ''
}

function transformJsOf(value: unknown): string {
  return (value as NormalizedDataSource | undefined)?.transformJs ?? ''
}
</script>

<template>
  <VExpansionPanel>
    <VExpansionPanelTitle>
      <div class="d-flex flex-column ga-1 w-100">
        <div class="d-flex align-center ga-2" @click.stop>
          <VCheckbox
            :model-value="selected"
            hide-details
            density="compact"
            :data-test-id="`item-checkbox-${updateItemKey(item)}`"
            @update:model-value="$emit('toggle')"
          />
          <span>{{ item.key }}</span>
          <VChip size="small" :color="kindColor(item.kind)">
            {{ item.kind }}
          </VChip>
          <VChip v-if="item.conflict" size="small" color="warning">
            conflict
          </VChip>
        </div>
        <VAlert
          v-if="selected && missingAssignment"
          type="warning"
          variant="tonal"
          density="compact"
          data-test-id="recipe-update-missing-field-warning"
          @click.stop
        >
          Missing a value for {{ missingAssignment.assignments.map(a => a.deviceName).join(', ') }}
        </VAlert>
      </div>
    </VExpansionPanelTitle>
    <VExpansionPanelText>
      <RecipeUpdateLineDiff v-if="item.itemType === 'template'" :before="liquidMarkupOf(item.local)" :after="liquidMarkupOf(item.upstream)" />
      <template v-else>
        <RecipeUpdatePropertyTable :rows="propertyRowsFor(item)" />
        <template v-if="isFetchDataSource(item)">
          <div class="text-medium-emphasis text-caption mt-2">
            transformJs
          </div>
          <RecipeUpdateLineDiff :before="transformJsOf(item.local)" :after="transformJsOf(item.upstream)" />
        </template>
      </template>
    </VExpansionPanelText>
  </VExpansionPanel>
</template>
