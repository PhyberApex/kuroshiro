<script setup lang="ts">
import type { DataSourceMethod } from 'kuroshiro-shared'
import type { DataSourceDraft } from './pluginDataSources'
import type { SelectOption } from '@/components/selectOption'
import { DATA_SOURCE_METHODS } from 'kuroshiro-shared'
import { computed, ref } from 'vue'
import CodeEditor from '@/components/CodeEditor.vue'
import Field from '@/components/Field.vue'
import Select from '@/components/Select.vue'
import TextInput from '@/components/TextInput.vue'
import TuckedSection from '@/components/TuckedSection.vue'
import DataSourceCode from './DataSourceCode.vue'
import { codeProblems } from './pluginDataSources'
import { transformTitle } from './pluginDataSourceWording'
import { fieldId } from './pluginPage'

/** What a Data Source in Fetch mode is made of: the request, its headers, its body and its transform. */
const props = defineProps<{
  /** The path a save sends the Data Source at: `dataSources.2`. */
  path: string
  /** The form's problems, by path. */
  errors: Record<string, string>
}>()

const source = defineModel<DataSourceDraft>('source', { required: true })

const METHOD_OPTIONS: SelectOption<DataSourceMethod>[] = DATA_SOURCE_METHODS.map(method => ({ value: method, label: method }))

const problems = computed(() => codeProblems(source.value))
const transformOpen = ref(false)

const at = (field: string) => `${props.path}.${field}`
</script>

<template>
  <Field
    :id="fieldId(at('url'))"
    v-slot="{ control }"
    class="request"
    label="Request"
    hint="The response must be JSON. A Field Value can be used as {{ keyname }} here, in the headers and in the body."
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
      <TextInput v-model="source.url" v-bind="control" wide spellcheck="false" />
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
  <TuckedSection v-model:open="transformOpen" class="transform" :title="transformTitle(source.transformJs)" heading="h4">
    <p class="about">
      JavaScript that reshapes the response before the template sees it. It runs on this server at every fetch.
    </p>
    <CodeEditor v-model="source.transformJs" aria-label="Transform" mode="javascript" size="code-input" />
  </TuckedSection>
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
    gap: var(--space-2);
  }

  :deep(.method) {
    min-width: 5.5rem;
  }

  /* An `h4` is the one heading the reset leaves its margins. */
  .transform :deep(h4) {
    margin: 0;
  }

  .about {
    margin-bottom: var(--space-3);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
