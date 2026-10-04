<script setup lang="ts">
import type { DataSourceMode } from 'kuroshiro-shared'
import type { DataSourceDraft } from './pluginDataSources'
import type { Segment } from '@/components/SegmentedFilter.vue'
import { computed, useId } from 'vue'
import Field from '@/components/Field.vue'
import SegmentedFilter from '@/components/SegmentedFilter.vue'
import TextInput from '@/components/TextInput.vue'
import DataSourceCode from './DataSourceCode.vue'
import DataSourceFetchFields from './DataSourceFetchFields.vue'
import { codeProblems } from './pluginDataSources'
import { fieldId } from './pluginPage'

/** The form of an opened Data Source. Both modes' entries stay in the draft, so switching the mode and back loses nothing. */
const props = defineProps<{
  /** The path a save sends the Data Source at: `dataSources.2`. */
  path: string
  /** The form's problems, by path. */
  errors: Record<string, string>
}>()

const source = defineModel<DataSourceDraft>('source', { required: true })

const MODES: Segment<DataSourceMode>[] = [
  { value: 'fetch', label: 'Fetch' },
  { value: 'literal', label: 'Literal' },
]

const ABOUT_MODE: Record<DataSourceMode, string> = {
  fetch: 'An HTTP request Kuroshiro makes at every scheduled render.',
  literal: 'A fixed JSON value you type here.',
}

const modeLabelId = useId()
const literalProblem = computed(() => codeProblems(source.value).literalValue)
const readAs = computed(() => source.value.name.trim() ? `The template reads it as {{ ${source.value.name.trim()} }}.` : undefined)

const at = (field: string) => `${props.path}.${field}`
</script>

<template>
  <div class="form">
    <Field
      :id="fieldId(at('name'))"
      v-slot="{ control }"
      label="Name"
      :hint="readAs"
      :error="errors[at('name')]"
    >
      <TextInput v-model="source.name" v-bind="control" class="name" spellcheck="false" autocapitalize="off" />
    </Field>
    <div class="mode">
      <p :id="modeLabelId" class="label">
        Data Source Mode
      </p>
      <SegmentedFilter v-model="source.mode" :segments="MODES" :aria-labelledby="modeLabelId" />
      <p class="hint">
        {{ ABOUT_MODE[source.mode] }}
      </p>
    </div>
    <DataSourceFetchFields v-if="source.mode === 'fetch'" v-model:source="source" :path="path" :errors="errors" />
    <DataSourceCode
      v-else
      :id="fieldId(at('literalValue'))"
      v-model="source.literalValue"
      label="Value"
      hint="JSON."
      mode="json"
      :error="errors[at('literalValue')]"
      :problem="literalProblem"
    />
  </div>
</template>

<style scoped>
@layer components {
  .form {
    display: grid;
    align-content: start;
    gap: var(--space-4);
    min-width: 0;
  }

  :deep(.name) {
    width: 14rem;
  }

  .mode {
    display: grid;
    justify-items: start;
  }

  .label {
    padding-bottom: var(--space-1);
    font-weight: var(--weight-medium);
  }

  .hint {
    padding-top: var(--space-1);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
