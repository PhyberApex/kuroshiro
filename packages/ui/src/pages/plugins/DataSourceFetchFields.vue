<script setup lang="ts">
import type { DataSourceMethod } from 'kuroshiro-shared'
import type { DataSourceDraft } from './pluginDataSources'
import type { SelectOption } from '@/components/selectOption'
import { DATA_SOURCE_METHODS } from 'kuroshiro-shared'
import { computed } from 'vue'
import Field from '@/components/Field.vue'
import Select from '@/components/Select.vue'
import Textarea from '@/components/Textarea.vue'
import DataSourceCode from './DataSourceCode.vue'
import { codeProblems } from './pluginDataSources'
import { fieldId } from './pluginPage'

/** What a Data Source in Fetch mode is made of: the request, its headers and its body. */
const props = defineProps<{
  /** The path a save sends the Data Source at: `dataSources.2`. */
  path: string
  /** The form's problems, by path. */
  errors: Record<string, string>
}>()

const source = defineModel<DataSourceDraft>('source', { required: true })

const METHOD_OPTIONS: SelectOption<DataSourceMethod>[] = DATA_SOURCE_METHODS.map(method => ({ value: method, label: method }))

const problems = computed(() => codeProblems(source.value))

const at = (field: string) => `${props.path}.${field}`
</script>

<template>
  <Field
    :id="fieldId(at('url'))"
    v-slot="{ control }"
    class="request"
    label="Request"
    hint="The response must be JSON. A Field Value can be used as {{ keyname }} here, in the headers and in the body. Several addresses, one per line, read as IDX_0, IDX_1 and so on."
    :error="errors[at('url')]"
  >
    <span class="request-line">
      <Select
        class="method"
        aria-label="Request method"
        :model-value="source.method"
        :options="METHOD_OPTIONS"
        @update:model-value="method => source.method = method ?? 'GET'"
      />
      <Textarea v-model="source.url" v-bind="control" class="addresses" rows="1" spellcheck="false" />
    </span>
  </Field>
  <DataSourceCode
    :id="fieldId(at('headers'))"
    v-model="source.headers"
    label="Headers"
    hint="A JSON object. Keep a secret in a password Plugin Field and name it here, not in the header itself."
    mode="json"
    :error="errors[at('headers')]"
    :problem="problems.headers"
  />
  <DataSourceCode
    v-if="source.method === 'POST'"
    :id="fieldId(at('body'))"
    v-model="source.body"
    label="Body"
    hint="A JSON object, sent with POST."
    mode="json"
    :error="errors[at('body')]"
    :problem="problems.body"
  />
</template>

<style scoped>
@layer components {
  .field.request {
    justify-items: stretch;
    max-width: none;
  }

  .request-line {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    gap: var(--space-2);
  }

  :deep(.addresses) {
    width: 100%;
    resize: vertical;
  }

  :deep(.method) {
    min-width: 5.5rem;
  }

  /* An `h4` is the one heading the reset leaves its margins. */

  .about {
    margin-bottom: var(--space-3);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
