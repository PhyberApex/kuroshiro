<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import FileDrop from '@/components/FileDrop.vue'
import { formatBytes } from '@/components/fileRules'
import Notice from '@/components/Notice.vue'
import LoadingLine from '@/patterns/LoadingLine.vue'
import ImportOutcome from './ImportOutcome.vue'
import { useImportSteps } from './importSteps'
import ImportSummary from './ImportSummary.vue'

const props = defineProps<{
  /** The Instance has no Device: there is nothing an import could leave. */
  fresh: boolean
  /** The largest archive the Instance takes. */
  maxBytes: number
  /** This Kuroshiro's version. */
  version: string
}>()

const { step, read, confirm, startOver } = useImportSteps(() => props.version)

const limit = computed(() => formatBytes(props.maxBytes))
const fileWording = computed(() => ({
  prompt: 'Drop a Configuration Archive here: the .zip a Configuration Export made.',
  wrongType: 'A Configuration Archive is a .zip.',
  tooLarge: (size: string) => `This file is ${size}. A Configuration Archive can be up to ${limit.value}.`,
}))

const stage = useTemplateRef('stage')
const fileInputId = 'configuration-archive-file'

/** Each step takes the place of the one before, and the control that had the focus goes with it: the focus follows to the new step, or back to the file input. */
watch(() => step.value.at, async (at) => {
  await nextTick()
  if (at === 'choose')
    document.getElementById(fileInputId)?.focus()
  else
    stage.value?.focus()
})
</script>

<template>
  <div ref="stage" class="stage" tabindex="-1">
    <FileDrop
      v-if="step.at === 'choose'"
      :id="fileInputId"
      :model-value="null"
      :accept="['.zip']"
      :max-bytes="maxBytes"
      :wording="fileWording"
      @update:model-value="$event && read($event)"
    />
    <LoadingLine :shown="step.at === 'reading'">
      <template v-if="step.at === 'reading'">
        Reading {{ step.file.name }}
      </template>
    </LoadingLine>
    <ImportSummary
      v-if="step.at === 'read'"
      :file-name="step.file.name"
      :check="step.check"
      :fresh="fresh"
      :importing="step.importing"
      @confirm="confirm"
      @cancel="startOver"
    />
    <ImportOutcome :summary="step.at === 'imported' ? step.summary : undefined" @another="startOver" />
    <Notice
      v-if="step.at === 'refused'"
      :title="step.notice.title"
      :reason="step.notice.reason"
      action="Choose another file"
      @act="startOver"
    />
  </div>
</template>

<style scoped>
@layer components {
  .stage {
    margin-top: var(--space-4);
  }

  /* The stage takes the focus only to keep it in the section; it is not a control. */
  .stage:focus {
    outline: none;
  }
}
</style>
