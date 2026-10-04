<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import { computed, reactive } from 'vue'
import { createScreen } from '@/api/screens'
import CodeEditor from '@/components/CodeEditor.vue'
import Field from '@/components/Field.vue'
import AddScreenFoot from './AddScreenFoot.vue'
import { useAddScreen } from './addScreenForm'
import HtmlPreview from './HtmlPreview.vue'
import ScreenNameField from './ScreenNameField.vue'
import { screenNameProblem } from './screenNaming'

const props = defineProps<{
  device: DeviceDetail
}>()

const addition = useAddScreen(['name', 'html'])

const draft = reactive({ name: '', html: '' })

const changed = computed(() => !addition.added && (draft.name.trim() !== '' || draft.html.trim() !== ''))

function add() {
  void addition.create(() => createScreen({ kind: 'html', deviceId: props.device.id, name: draft.name.trim(), html: draft.html }), {
    name: screenNameProblem(draft.name),
    html: draft.html.trim() ? undefined : 'Write the HTML this Screen is rendered from.',
  })
}
</script>

<template>
  <form class="add-html-screen" novalidate @submit.prevent="add">
    <ScreenNameField v-model="draft.name" :error="addition.problems.name" />
    <Field v-slot="{ control }" class="markup" label="HTML" :error="addition.problems.html">
      <CodeEditor v-model="draft.html" v-bind="control" aria-label="HTML" mode="html" />
    </Field>
    <HtmlPreview :device="device" :html="draft.html" name="Preview of the new Screen" />
    <AddScreenFoot :running="addition.running" :changed="changed" :failure="addition.failure" />
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
}
</style>
