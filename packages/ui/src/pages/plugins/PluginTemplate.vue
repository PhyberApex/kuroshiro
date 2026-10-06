<script setup lang="ts">
import type { TemplateSize } from 'kuroshiro-shared'
import type { PreviewChoice } from './previewTarget'
import type { PreviewSource } from './useTemplatePreview'
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { listDeviceModels, listPalettes } from '@/api/device-models'
import { previewPluginData } from '@/api/plugins'
import Button from '@/components/Button.vue'
import CodeEditor from '@/components/CodeEditor.vue'
import EditorBench from '@/components/EditorBench.vue'
import PageSection from '@/patterns/PageSection.vue'
import { useLoad } from '@/patterns/useLoad'
import { useDevices } from '@/reads/sharedReads'
import { fieldArrived, fieldId, usePluginFormPart, usePluginPage } from './pluginPage'
import { templatePaths, templatesPart, withTemplateAdded } from './pluginTemplates'
import { editorName } from './pluginTemplateWording'
import { startingChoice, targetOf } from './previewTarget'
import ScheduledRenderFailure from './ScheduledRenderFailure.vue'
import { heldWithForm } from './templateContext'
import { scheduledFailure } from './templateData'
import TemplateData from './TemplateData.vue'
import TemplateLine from './TemplateLine.vue'
import TemplatePlate from './TemplatePlate.vue'
import TemplatePreviewFor from './TemplatePreviewFor.vue'
import { TEMPLATE_WINDOW_FOOT, useTemplateWindow, useWindowTaken } from './templateWindow'
import { devicePreviewSourceOf, useDevicePreview } from './useDevicePreview'
import { usePreviewData } from './usePreviewData'
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
    const start = startingChoice(plugin.value.assignments, devices.data ?? [])
    const deviceGone = picked.value?.deviceId != null && !devices.data?.some(device => device.id === picked.value?.deviceId)
    return !picked.value || deviceGone ? start : picked.value
  },
  set: next => (picked.value = next),
})
const target = computed(() => library.value && targetOf(choice.value, library.value))
const previewDevice = computed(() => devices.data?.find(device => device.id === choice.value.deviceId))

// The sections below this one join the form as they are mounted, and the first fetch sends all of it.
const formStands = ref(false)
onMounted(() => (formStands.value = true))

/** The data is fetched for the Device the preview is for, which is known once the Devices are. */
const fetched = usePreviewData(
  () => formStands.value && devices.data
    ? { deviceId: previewDevice.value?.id ?? null, name: form.unsaved.name, dataSources: form.unsaved.dataSources, fieldValues: form.unsaved.fieldValues }
    : undefined,
  input => previewPluginData(plugin.value.id, input),
)

/** What the Template reads: the data the server fetched last, with the form's name and Field Values as they stand now. */
const data = computed(() => fetched.held.value && heldWithForm(fetched.held.value, plugin.value, form.unsaved))

const preview = useTemplatePreview((): PreviewSource | undefined => needs.data && target.value && data.value && {
  markup: markup.value,
  size: row.value.size,
  context: data.value.context,
  target: target.value,
  render: needs.data.previewOf,
})

/** What a device preview request draws (ADR-0040): the last rendered body, for the chosen Device Model and Palette. Any change to it drops a device preview back to the live browser drawing. */
const devicePreview = useDevicePreview(() => target.value && preview.body.value !== null
  ? devicePreviewSourceOf(target.value, preview.body.value)
  : undefined)

const completionData = computed(() => data.value && !Array.isArray(data.value.context) ? data.value.context : {})

/** Why the plate has no drawing yet: the Device Models or the first data are on their way. A fetch that failed says so under the plate. */
const waitingFor = computed(() => {
  if (!target.value)
    return 'Loading the preview'
  return fetched.fetching.value ? 'Fetching the data' : undefined
})

/** What stops a save at this Template once one was tried: the form's own check, or what the server refused it with. */
const saveProblem = computed(() => part.problems.find(found => found.path === path.value))

const problem = computed(() => {
  if (row.value.removed)
    return null
  return preview.problem.value?.problem ?? (saveProblem.value ? { message: saveProblem.value.message, line: saveProblem.value.line ?? null } : null)
})

const invalid = computed(() => !row.value.removed && (preview.problem.value?.stopsSave === true || saveProblem.value !== undefined))

/** The chosen Template is marked as it is shown in the editor, with the pause that typing gets; any other one as it stands. */
const unparsed = computed(() => rows.value
  .filter((candidate, index) => {
    if (candidate === row.value)
      return invalid.value
    const stopsSave = part.errors[paths.value[index] ?? ''] !== undefined
    return !candidate.removed && (stopsSave || needs.data?.checkTemplate(candidate.liquidMarkup) != null)
  })
  .map(candidate => candidate.size))

const editor = useTemplateRef('editor')

const templateWindow = useTemplateWindow()
const inWindow = templateWindow.open
const title = computed(() => inWindow.value ? `Template of ${plugin.value.name}` : 'Template')

function toggleWindow() {
  return inWindow.value ? templateWindow.leave() : templateWindow.enter()
}
const section = useTemplateRef('section')
useWindowTaken(() => section.value?.$el, inWindow)

/** "Data" is closed on the page and open in the full window, until the admin says otherwise in either. */
const dataOpenIn = ref({ page: false, window: true })
const dataOpen = computed({
  get: () => dataOpenIn.value[inWindow.value ? 'window' : 'page'],
  set: open => (dataOpenIn.value[inWindow.value ? 'window' : 'page'] = open),
})

const failedRender = computed(() => scheduledFailure(plugin.value.lastScheduledRender))
const failedTemplateStands = computed(() => rows.value.some(candidate => candidate.size === failedRender.value?.size))

/** "Go to line {n}" of the scheduled render's failure: chooses the Template that failed and puts the cursor there. */
async function goToFailedLine(line: number) {
  const failed = failedRender.value
  if (!failed)
    return
  chosen.value = failed.size
  await nextTick()
  editor.value?.goToLine(line)
}

function add(size: TemplateSize) {
  part.draft.rows = withTemplateAdded(rows.value, size)
  chosen.value = size
}

function setRemoved(size: TemplateSize, removed: boolean) {
  const changed = rows.value.find(candidate => candidate.size === size)
  if (changed)
    changed.removed = removed
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
  <PageSection
    id="template"
    ref="section"
    class="template-section"
    :class="{ 'template-window': inWindow }"
    :title="title"
  >
    <template v-if="templateWindow.offered.value" #actions>
      <Button @click="toggleWindow">
        {{ inWindow ? 'Back to the page' : 'Full window' }}
      </Button>
    </template>
    <ScheduledRenderFailure v-if="failedRender" :failure="failedRender" :reachable="failedTemplateStands" @go-to-line="goToFailedLine" />
    <TemplateLine
      v-model:chosen="chosen"
      :rows="rows"
      :unparsed="unparsed"
      @add="add"
      @added="editor?.focus()"
      @remove="setRemoved($event, true)"
      @put-back="setRemoved($event, false)"
    />
    <EditorBench class="template-bench" :full-window="inWindow">
      <template #editor>
        <CodeEditor
          :id="path && fieldId(path)"
          ref="editor"
          v-model="markup"
          mode="liquid"
          :size="inWindow ? 'full-window' : 'bench'"
          :document="row.size"
          :aria-label="editorName(plugin.name, row.size)"
          :read-only="row.removed"
          :strip-note="row.removed ? 'This template is removed when you save.' : undefined"
          :invalid="invalid"
          :problem="problem"
          :completion-data="completionData"
          :kuroshiro-filters="needs.data?.filters"
          @save="save"
        />
      </template>
      <template #plate>
        <TemplatePlate
          :plugin-name="plugin.name"
          :load-failure="needs.data ? undefined : needs.failure?.reason"
          :nothing-to-draw-for="library !== undefined && !target"
          :model="target?.model"
          :document="preview.document.value"
          :not-drawn="preview.problem.value !== null"
          :waiting-for="waitingFor"
          :has-data="data !== undefined"
          :device-preview="devicePreview.state.value"
          :device-name="target?.device?.name ?? null"
          @retry="needs.reload"
        />
      </template>
      <TemplatePreviewFor
        v-if="library && target"
        v-model:choice="choice"
        :library="library"
        :target="target"
        :size="row.size"
        :device-preview="devicePreview.state.value"
        @draw-device-preview="devicePreview.draw"
        @back-to-browser="devicePreview.backToBrowser"
      />
      <TemplateData
        v-model:open="dataOpen"
        :data="data"
        :fetching="fetched.fetching.value"
        :failure="fetched.failure.value"
        :device-name="previewDevice?.name ?? null"
        @fetch="fetched.fetchAgain"
      />
    </EditorBench>
    <div :id="TEMPLATE_WINDOW_FOOT" class="window-foot" />
  </PageSection>
</template>

<style scoped>
@layer components {
  /* Not `bench`: the editor inside wears that class for its size, and it stands in this component's scope. */
  .template-bench {
    margin-top: var(--space-3);
  }

  /*
  The full window: the section covers everything under the bar, and lies under the bar's own layer so that the bar's
  menus and the save bar at its foot stand on it. It is the same element as on the page, so nothing in it starts anew.
  */
  .template-section.template-window {
    position: fixed;
    inset: var(--bar-height) 0 0;
    z-index: calc(var(--layer-bar) - 1);
    display: flex;
    flex-direction: column;
    margin-top: 0;
    padding: var(--space-5) var(--gutter) 0;
    background: var(--color-paper);
  }

  .template-window .template-bench {
    flex: 1 1 0;
    grid-template-rows: minmax(0, 1fr);
    height: auto;
  }

  /* Where the page's save bar stands in the full window. It is in the page from the start, so the bar finds it. */
  .window-foot {
    display: none;
  }

  .template-window .window-foot {
    display: block;
    flex: none;
    min-height: var(--space-5);
  }

  .window-foot :deep(.save-bar) {
    margin-top: var(--space-4);
  }
}
</style>
