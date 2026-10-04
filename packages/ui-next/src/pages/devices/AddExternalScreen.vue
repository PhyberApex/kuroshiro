<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import type { FetchChoice } from './fetchChoices'
import { computed, reactive, ref } from 'vue'
import { fieldErrorsOf, isRefusal } from '@/api/client'
import { createScreen } from '@/api/screens'
import Field from '@/components/Field.vue'
import RadioRow from '@/components/RadioRow.vue'
import TextInput from '@/components/TextInput.vue'
import AddScreenFoot from './AddScreenFoot.vue'
import { useAddScreen } from './addScreenForm'
import { FETCH_CHOICES, NOT_A_WEB_ADDRESS } from './fetchChoices'
import ScreenNameField from './ScreenNameField.vue'
import { screenNameProblem } from './screenNaming'
import { isWebAddress } from './screenSourceWording'

const props = defineProps<{
  device: DeviceDetail
}>()

const adding = useAddScreen()

const draft = reactive({ name: '', url: '', fetching: 'keep' as FetchChoice })
const problems = ref<{ name?: string, url?: string }>({})

const changed = computed(() => !adding.added && (draft.name.trim() !== '' || draft.url.trim() !== '' || draft.fetching !== 'keep'))

const hasProblems = () => Boolean(problems.value.name || problems.value.url)

/** An address that gave no image is a problem of the address: the Screen is not added and the field says why. */
function placed(error: unknown) {
  const { name, url } = fieldErrorsOf(error)
  const noImage = isRefusal(error, 'image-fetch-failed') || isRefusal(error, 'image-unreadable') ? error.message : undefined
  problems.value = { name, url: url ?? noImage }
  return hasProblems()
}

function add() {
  problems.value = {
    name: screenNameProblem(draft.name),
    url: isWebAddress(draft.url) ? undefined : NOT_A_WEB_ADDRESS,
  }
  if (hasProblems())
    return
  void adding.add(() => createScreen({
    kind: 'external',
    deviceId: props.device.id,
    name: draft.name.trim(),
    url: draft.url.trim(),
    fetchManual: draft.fetching === 'keep',
  }), placed)
}
</script>

<template>
  <form class="add-external-screen" novalidate @submit.prevent="add">
    <ScreenNameField v-model="draft.name" :error="problems.name" />
    <Field v-slot="{ control }" class="address" label="Image URL" :error="problems.url">
      <TextInput v-model="draft.url" v-bind="control" type="url" inputmode="url" spellcheck="false" autocomplete="off" wide />
    </Field>
    <RadioRow v-model="draft.fetching" class="fetching" :choices="FETCH_CHOICES" aria-label="Fetching" />
    <AddScreenFoot :running="adding.adding" :changed="changed" :failure="adding.failure" />
  </form>
</template>

<style scoped>
@layer components {
  .add-external-screen {
    display: grid;
    gap: var(--space-4);
  }

  .field.address {
    justify-items: stretch;
    max-width: none;
  }

  .fetching {
    border-top: var(--rule);
  }
}
</style>
