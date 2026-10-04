<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import { computed, reactive, ref } from 'vue'
import { fieldErrorsOf } from '@/api/client'
import { createScreen } from '@/api/screens'
import Field from '@/components/Field.vue'
import Textarea from '@/components/Textarea.vue'
import AddScreenFoot from './AddScreenFoot.vue'
import { useAddScreen } from './addScreenForm'
import HtmlPreview from './HtmlPreview.vue'
import ScreenNameField from './ScreenNameField.vue'
import { screenNameProblem } from './screenNaming'

const props = defineProps<{
  device: DeviceDetail
}>()

const adding = useAddScreen()

const draft = reactive({ name: '', html: '' })
const problems = ref<{ name?: string, html?: string }>({})

const changed = computed(() => !adding.added && (draft.name.trim() !== '' || draft.html.trim() !== ''))

const hasProblems = () => Boolean(problems.value.name || problems.value.html)

function placed(error: unknown) {
  const { name, html } = fieldErrorsOf(error)
  problems.value = { name, html }
  return hasProblems()
}

function add() {
  problems.value = {
    name: screenNameProblem(draft.name),
    html: draft.html.trim() ? undefined : 'Write the HTML this Screen is rendered from.',
  }
  if (hasProblems())
    return
  void adding.add(() => createScreen({ kind: 'html', deviceId: props.device.id, name: draft.name.trim(), html: draft.html }), placed)
}
</script>

<template>
  <form class="add-html-screen" novalidate @submit.prevent="add">
    <ScreenNameField v-model="draft.name" :error="problems.name" />
    <Field v-slot="{ control }" class="markup" label="HTML" :error="problems.html">
      <Textarea v-model="draft.html" v-bind="control" class="code" spellcheck="false" autocapitalize="off" autocomplete="off" />
    </Field>
    <HtmlPreview :device="device" :html="draft.html" name="Preview of the new Screen" />
    <AddScreenFoot :running="adding.adding" :changed="changed" :failure="adding.failure" />
  </form>
</template>

<style scoped>
@layer components {
  .add-html-screen {
    display: grid;
    gap: var(--space-4);
  }

  .field.markup {
    justify-items: stretch;
    max-width: none;
  }

  /* The textarea is not its component's root, so it does not carry this component's scope. */
  .markup :deep(.code) {
    min-height: 14rem;
    font-size: var(--text-xs);
  }
}
</style>
