<script setup lang="ts">
import type { PluginDetail } from 'kuroshiro-shared'
import type { PluginArrival } from './pluginArrival'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { updatePlugin } from '@/api/plugins'
import ProblemLines from '@/components/ProblemLines.vue'
import SaveBar from '@/components/SaveBar.vue'
import UnsavedChanges from '@/patterns/UnsavedChanges.vue'
import PluginFactsLine from './PluginFactsLine.vue'
import { changedSentence, createPluginForm, lostSentence, thingsToFix } from './pluginForm'
import PluginOnceLines from './PluginOnceLines.vue'
import { fieldId, providePluginPage } from './pluginPage'
import { arrivalLine, pluginFacts, pluginProblems, savedLine } from './pluginPageWording'
import { TEMPLATE_WINDOW_FOOT, useTemplateWindow } from './templateWindow'

/** The Plugin page once its Plugin is there: what it says about the Plugin, the sections and the one form they join. */
const props = defineProps<{
  plugin: PluginDetail
  /** What the page was opened with, for its line shown once. */
  arrival?: PluginArrival
  reload: () => Promise<void>
}>()

const emit = defineEmits<{
  /** A save went through; the Plugin is what the server answered. */
  saved: [plugin: PluginDetail]
}>()

defineSlots<{
  default?: (props: { plugin: PluginDetail }) => unknown
  tucked?: (props: { plugin: PluginDetail }) => unknown
}>()

const form = createPluginForm(props.plugin, input => updatePlugin(props.plugin.id, input))
watch(() => props.plugin, fresh => form.refresh(fresh))

const leaving = useTemplateRef('leaving')

const templateWindow = useTemplateWindow()

const savedAt = ref<Date>()

const onceLines = computed(() => [
  ...(props.arrival ? [{ key: 'arrival', ...arrivalLine(props.arrival) }] : []),
  ...(savedAt.value ? [{ key: `saved-${savedAt.value.getTime()}`, ...savedLine(savedAt.value, props.plugin) }] : []),
])

async function save() {
  const answer = await form.save()
  if (!answer)
    return
  savedAt.value = new Date()
  emit('saved', answer)
}

providePluginPage({
  plugin: computed(() => props.plugin),
  form,
  save,
  reload: () => props.reload(),
  leaveFor: async action => leaving.value?.leaveFor(action),
})

async function showFirst() {
  const path = await form.showFirst()
  if (!path)
    return
  // In the Template section's full window only that section can be reached: a field of another one is on the page.
  if (templateWindow.open.value && !path.startsWith('templates.'))
    await templateWindow.leave()
  await nextTick()
  const control = document.getElementById(fieldId(path))
  control?.scrollIntoView({ block: 'center' })
  control?.focus()
}
</script>

<template>
  <PluginFactsLine :facts="pluginFacts(plugin)" />
  <PluginOnceLines :lines="onceLines" />
  <ProblemLines class="problems" :lines="pluginProblems(plugin)" />
  <slot :plugin="plugin" />
  <div class="tucked">
    <slot name="tucked" :plugin="plugin" />
  </div>
  <!-- In the Template section's full window the bar stands at the foot of the window, which that section renders. -->
  <Teleport defer :to="`#${TEMPLATE_WINDOW_FOOT}`" :disabled="!templateWindow.open.value">
    <SaveBar
      :changed="form.changed"
      save-label="Save Plugin"
      cancel-label="Discard changes"
      :saving="form.saving"
      :invalid="form.problems.length > 0 ? thingsToFix(form.problems.length) : undefined"
      :failed="form.failure !== undefined"
      :reason="form.failure"
      @save="save"
      @cancel="form.discard"
      @show-first="showFirst"
    >
      {{ changedSentence(form.changedKeys, { previewed: form.previewed }) }}
    </SaveBar>
  </Teleport>
  <UnsavedChanges ref="leaving" :when="form.changed">
    <template #lost>
      {{ lostSentence(plugin.name, form.changedKeys) }}
    </template>
  </UnsavedChanges>
</template>

<style scoped>
@layer components {
  .problems {
    margin-top: var(--space-4);
  }

  .tucked {
    margin-top: var(--space-12);
  }
}
</style>
