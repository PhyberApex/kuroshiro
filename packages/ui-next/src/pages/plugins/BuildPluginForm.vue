<script setup lang="ts">
import type { PluginKind } from 'kuroshiro-shared'
import type { BuildProblems } from './addPlugin'
import { computed, nextTick, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fieldErrorsOf } from '@/api/client'
import { createPlugin } from '@/api/plugins'
import { failureReason } from '@/components/failureReason'
import Field from '@/components/Field.vue'
import TextInput from '@/components/TextInput.vue'
import { buildDraftChanged, buildInput, buildProblems, hasBuildProblems, newBuildDraft, streams } from './addPlugin'
import AddPluginFoot from './AddPluginFoot.vue'
import { useAddPluginPage } from './addPluginPage'
import BuildWebhookMerge from './BuildWebhookMerge.vue'
import { openPluginPage } from './pluginArrival'

const props = defineProps<{
  kind: PluginKind
}>()

const WHAT_IT_DOES: Record<PluginKind, string> = {
  Poll: 'Kuroshiro fetches its Data Sources on a schedule and renders them with a template. You write both on the Plugin\'s page, which opens next.',
  Webhook: 'Kuroshiro gives the Plugin a Webhook URL. Whatever is POSTed there becomes its Webhook Payload and is rendered at once.',
}

const WHAT_STAYS: Record<PluginKind, string> = {
  Poll: 'A Poll Plugin stays a Poll Plugin: the Plugin Kind cannot be changed later.',
  Webhook: 'The Plugin Kind and the Merge Strategy cannot be changed later.',
}

const router = useRouter()
const { device } = useAddPluginPage()

const draft = reactive(newBuildDraft())
const problems = ref<BuildProblems>({})
const failure = ref<string>()
const creating = ref(false)
const created = ref(false)

const changed = computed(() => !created.value && buildDraftChanged(draft))

function refusedFields(error: unknown): BuildProblems {
  const { name, streamLimit } = fieldErrorsOf(error)
  return { name, streamLimit: streams(props.kind, draft) ? streamLimit : undefined }
}

async function create() {
  problems.value = buildProblems(props.kind, draft)
  failure.value = undefined
  if (hasBuildProblems(problems.value))
    return
  creating.value = true
  try {
    const plugin = await createPlugin(buildInput(props.kind, draft, device.value?.id))
    created.value = true
    await nextTick()
    await openPluginPage(router, plugin.id, { how: 'created', device: device.value })
  }
  catch (error) {
    problems.value = refusedFields(error)
    if (!hasBuildProblems(problems.value))
      failure.value = `Not created. ${failureReason(error) ?? 'Something went wrong.'}`
  }
  finally {
    creating.value = false
  }
}
</script>

<template>
  <form class="build-plugin" novalidate @submit.prevent="create">
    <Field v-slot="{ control }" class="name" label="Name" :error="problems.name">
      <TextInput v-model="draft.name" v-bind="control" prose wide autocomplete="off" />
    </Field>
    <BuildWebhookMerge
      v-if="kind === 'Webhook'"
      v-model:merge-strategy="draft.mergeStrategy"
      v-model:stream-limit="draft.streamLimit"
      :stream-limit-problem="problems.streamLimit"
    />
    <p class="what-it-does">
      {{ WHAT_IT_DOES[kind] }}
    </p>
    <AddPluginFoot button="Create Plugin" :running="creating" :changed="changed" :failure="failure">
      {{ WHAT_STAYS[kind] }}
    </AddPluginFoot>
  </form>
</template>

<style scoped>
@layer components {
  .build-plugin {
    display: grid;
    gap: var(--space-4);
  }

  .build-plugin .name {
    max-width: none;
  }

  .what-it-does {
    color: var(--color-ink-soft);
  }
}
</style>
