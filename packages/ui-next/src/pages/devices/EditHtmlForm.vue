<script setup lang="ts">
import type { DeviceDetail, ScreenRead } from 'kuroshiro-shared'
import { computed, nextTick, ref, useId } from 'vue'
import { useRouter } from 'vue-router'
import { updateScreen } from '@/api/screens'
import CodeEditor from '@/components/CodeEditor.vue'
import EditorBench from '@/components/EditorBench.vue'
import { failureReason, notSavedSentence } from '@/components/failureReason'
import AddFormFoot from '@/patterns/AddFormFoot.vue'
import { useDeviceFrame } from './deviceFrame'
import HtmlPreview from './HtmlPreview.vue'
import { possessive, screenName } from './screenNaming'

const props = defineProps<{
  device: DeviceDetail
  /** An HTML Screen of the Device. */
  screen: ScreenRead
}>()

const router = useRouter()
const { path } = useDeviceFrame()

const headingId = useId()

const named = computed(() => screenName(props.screen.name))
const saved = ref(props.screen.html ?? '')
const html = ref(saved.value)
const changed = computed(() => html.value !== saved.value)

const saving = ref(false)
const failure = ref<string>()

const openedRow = computed(() => `${path.value}?screen=${props.screen.id}`)

async function save() {
  if (saving.value)
    return
  failure.value = undefined
  if (!html.value.trim()) {
    failure.value = notSavedSentence('Write the HTML this Screen is rendered from.')
    return
  }
  saving.value = true
  try {
    const answered = await updateScreen(props.screen.id, { html: html.value })
    saved.value = answered.html ?? html.value
    html.value = saved.value
    await nextTick()
    await router.push(openedRow.value)
  }
  catch (error) {
    failure.value = notSavedSentence(failureReason(error))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="edit-html-form" novalidate :aria-labelledby="headingId" @submit.prevent="save">
    <h2 :id="headingId" class="heading">
      Edit {{ named }}
    </h2>
    <EditorBench class="html-bench">
      <template #editor>
        <CodeEditor v-model="html" mode="html" :aria-label="`HTML of ${named}`" @save="save" />
      </template>
      <template #plate>
        <HtmlPreview :device="device" :html="html" :name="`Preview of ${named}`" facts />
      </template>
    </EditorBench>
    <AddFormFoot
      button="Save HTML"
      :running="saving"
      :changed="changed"
      :failure="failure"
      :cancel-to="openedRow"
      retryable
      @retry="save"
    >
      {{ device.name }} shows the change when this Screen's turn next comes.
      <template #lost>
        Your changes to {{ possessive(named) }} HTML.
      </template>
    </AddFormFoot>
  </form>
</template>

<style scoped>
@layer components {
  .heading {
    margin-top: var(--space-4);
    padding-bottom: var(--space-2);
    border-bottom: var(--rule-heavy);
    font-stretch: var(--width-title);
    font-weight: var(--weight-title);
    font-size: var(--title-sm);
    line-height: var(--leading-title);
  }

  /* Not `bench`: the editor inside wears that class for its size, and it stands in this component's scope. */
  .html-bench {
    margin-top: var(--space-5);
    margin-bottom: var(--space-6);
  }
}
</style>
