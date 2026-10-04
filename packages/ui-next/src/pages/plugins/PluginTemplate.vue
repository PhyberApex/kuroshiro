<script setup lang="ts">
import type { TemplateSize } from 'kuroshiro-shared'
import type { PreviewChoice } from './previewTarget'
import type { PreviewSource } from './useTemplatePreview'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { listDeviceModels, listPalettes } from '@/api/device-models'
import CodeEditor from '@/components/CodeEditor.vue'
import EditorBench from '@/components/EditorBench.vue'
import Notice from '@/components/Notice.vue'
import PreviewPlate from '@/components/PreviewPlate.vue'
import PageSection from '@/patterns/PageSection.vue'
import { useLoad } from '@/patterns/useLoad'
import { useDevices } from '@/reads/sharedReads'
import { fieldArrived, fieldId, usePluginFormPart, usePluginPage } from './pluginPage'
import { templatePaths, templatesPart, withTemplateAdded } from './pluginTemplates'
import { editorName } from './pluginTemplateWording'
import { startingChoice, targetOf } from './previewTarget'
import { formContext } from './templateContext'
import TemplateLine from './TemplateLine.vue'
import TemplatePreviewFor from './TemplatePreviewFor.vue'
import { useTemplatePreview } from './useTemplatePreview'

const { plugin, form, save } = usePluginPage()
const devices = useDevices()

/** What the preview is drawn with and for, beside the form: the Liquid engine, fetched apart from the page, and the Device Models with their Palettes. */
async function loadEngine() {
  const { checkTemplate, KUROSHIRO_FILTERS, previewOf } = await import('./templatePreview')
  return { checkTemplate, filters: KUROSHIRO_FILTERS, previewOf }
}

const needs = useLoad(async () => {
  const [engine, { models }, palettes] = await Promise.all([loadEngine(), listDeviceModels(), listPalettes()])
  return { ...engine, models, palettes }
})

const part = usePluginFormPart(templatesPart(() => needs.data?.checkTemplate), reveal)

const chosen = ref<TemplateSize>('full')
const rows = computed(() => part.draft.rows)
const paths = computed(() => templatePaths(rows.value))
const chosenIndex = computed(() => Math.max(0, rows.value.findIndex(row => row.size === chosen.value)))
const row = computed(() => rows.value[chosenIndex.value]!)
const path = computed(() => paths.value[chosenIndex.value])

// A Template that was added and never saved is gone once the changes are discarded.
watch(() => rows.value.some(candidate => candidate.size === chosen.value), (there) => {
  if (!there)
    chosen.value = 'full'
})

const markup = computed({
  get: () => row.value.liquidMarkup,
  set: text => (row.value.liquidMarkup = text),
})

const library = computed(() => needs.data && devices.data && { devices: devices.data, models: needs.data.models, palettes: needs.data.palettes })

/** The admin's choice for this visit. Until there is one, and when its Device is gone, the preview is for where it starts. */
const picked = ref<PreviewChoice>()
const choice = computed({
  get: () => {
    const start = startingChoice(plugin.value.assignments, library.value?.devices ?? [])
    const deviceGone = picked.value?.deviceId != null && !library.value?.devices.some(device => device.id === picked.value?.deviceId)
    return !picked.value || deviceGone ? start : picked.value
  },
  set: next => (picked.value = next),
})
const target = computed(() => library.value && targetOf(choice.value, library.value))

/** What the Template reads. It is made of the form alone here; the data the server fetches takes its place. */
const context = computed(() => formContext(plugin.value, form.unsaved))

const preview = useTemplatePreview((): PreviewSource | undefined => needs.data && target.value && {
  markup: markup.value,
  size: row.value.size,
  context: context.value,
  target: target.value,
  render: needs.data.previewOf,
})

/** What the server said about this Template when it refused a save, until the Template is edited. */
const refused = computed(() => part.problems.find(problem => problem.path === path.value))

const problem = computed(() => {
  if (row.value.removed)
    return null
  return preview.problem.value?.problem ?? (refused.value ? { message: refused.value.message, line: refused.value.line ?? null } : null)
})

const invalid = computed(() => !row.value.removed && (preview.problem.value?.stopsSave === true || refused.value !== undefined))

/** The chosen Template is marked as it is shown in the editor, with the pause that typing gets; any other one as it stands. */
const unparsed = computed(() => rows.value
  .filter((candidate, index) => {
    if (candidate === row.value)
      return invalid.value
    const refusedByServer = part.errors[paths.value[index] ?? ''] !== undefined
    return !candidate.removed && (refusedByServer || needs.data?.checkTemplate(candidate.liquidMarkup) != null)
  })
  .map(candidate => candidate.size))

const editor = useTemplateRef('editor')

function add(size: TemplateSize) {
  part.draft.rows = withTemplateAdded(rows.value, size)
  chosen.value = size
}

function setRemoved(size: TemplateSize, removed: boolean) {
  const removedRow = rows.value.find(candidate => candidate.size === size)
  if (removedRow)
    removedRow.removed = removed
}

/** "Show the first": chooses the Template with the problem and puts the cursor at its place. */
async function reveal(problemPath: string) {
  const index = paths.value.indexOf(problemPath)
  const revealed = rows.value[index]
  if (!revealed)
    return
  chosen.value = revealed.size
  await nextTick()
  await fieldArrived(problemPath)
  const line = part.problems.find(found => found.path === problemPath)?.line
  if (line != null)
    editor.value?.goToLine(line)
}
</script>

<template>
  <PageSection id="template" title="Template">
    <TemplateLine
      v-model:chosen="chosen"
      :rows="rows"
      :unparsed="unparsed"
      @add="add"
      @added="editor?.focus()"
      @remove="setRemoved($event, true)"
      @put-back="setRemoved($event, false)"
    />
    <EditorBench class="template-bench">
      <template #editor>
        <CodeEditor
          :id="path && fieldId(path)"
          ref="editor"
          v-model="markup"
          mode="liquid"
          :document="row.size"
          :aria-label="editorName(plugin.name, row.size)"
          :read-only="row.removed"
          :strip-note="row.removed ? 'This template is removed when you save.' : undefined"
          :invalid="invalid"
          :problem="problem"
          :completion-data="Array.isArray(context) ? {} : context"
          :kuroshiro-filters="needs.data?.filters"
          @save="save"
        />
      </template>
      <template #plate>
        <Notice v-if="needs.failure && !needs.data" title="Could not load the preview." :reason="needs.failure.reason" action="Try again" @act="needs.reload" />
        <p v-else-if="library && !target" class="none">
          No preview: this Instance holds no Device Model with a Palette to draw it for.
        </p>
        <PreviewPlate
          v-else
          :name="`Preview of ${plugin.name}`"
          :document="preview.document.value"
          :width="target?.model.width ?? 800"
          :height="target?.model.height ?? 480"
          :not-drawn="preview.problem.value !== null"
          :rendering="!target"
          rendering-note="Loading the preview"
        />
      </template>
      <TemplatePreviewFor v-if="library && target" v-model:choice="choice" :library="library" :target="target" :size="row.size" />
    </EditorBench>
  </PageSection>
</template>

<style scoped>
@layer components {
  /* Not `bench`: the editor inside wears that class for its size, and it stands in this component's scope. */
  .template-bench {
    margin-top: var(--space-3);
  }

  .none {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
