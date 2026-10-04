<script setup lang="ts">
import { computed, ref } from 'vue'
import CodeEditor from '@/components/CodeEditor.vue'
import Field from '@/components/Field.vue'

/** One code input of a Data Source's form: the code editor in its code input size, as a field. */
const props = defineProps<{
  id: string
  label: string
  hint?: string
  mode: 'json' | 'javascript'
  /** What the form says is wrong with the field: once a save was tried, or the server's answer. */
  error?: string
  /** What is wrong with the code as it stands. It is shown once the field was left. */
  problem?: string
}>()

const code = defineModel<string>({ required: true })

const left = ref(false)

const shownError = computed(() => props.error ?? (left.value ? props.problem : undefined))
</script>

<template>
  <Field :id="id" v-slot="{ control }" class="code-field" :label="label" :hint="hint" :error="shownError">
    <CodeEditor v-model="code" v-bind="control" :aria-label="label" :mode="mode" size="code-input" @blur="left = true" />
  </Field>
</template>

<style scoped>
@layer components {
  .field.code-field {
    justify-items: stretch;
    max-width: none;
  }
}
</style>
