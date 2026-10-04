<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import type { FetchChoice } from './fetchChoices'
import { computed, reactive } from 'vue'
import { isRefusal } from '@/api/client'
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

/** An address that answers with something that is no image is worded for an address, where the general wording speaks of a file. */
const NOT_AN_IMAGE = 'This address does not answer with an image Kuroshiro can read. It has to be PNG, JPEG, BMP, GIF, TIFF or WebP.'

const addition = useAddScreen(['name', 'url'])

const draft = reactive({ name: '', url: '', fetching: 'keep' as FetchChoice })

const changed = computed(() => !addition.added && (draft.name.trim() !== '' || draft.url.trim() !== '' || draft.fetching !== 'keep'))

/** An address that gave no image is a problem of the address: the Screen is not added and the field says why. */
function noImage(error: unknown) {
  if (isRefusal(error, 'image-fetch-failed'))
    return { url: error.message }
  return isRefusal(error, 'image-unreadable') ? { url: NOT_AN_IMAGE } : {}
}

function add() {
  void addition.create(() => createScreen({
    kind: 'external',
    deviceId: props.device.id,
    name: draft.name.trim(),
    url: draft.url.trim(),
    fetchManual: draft.fetching === 'keep',
  }), {
    name: screenNameProblem(draft.name),
    url: isWebAddress(draft.url) ? undefined : NOT_A_WEB_ADDRESS,
  }, noImage)
}
</script>

<template>
  <form class="add-external-screen" novalidate @submit.prevent="add">
    <ScreenNameField v-model="draft.name" :error="addition.problems.name" />
    <Field v-slot="{ control }" class="address" label="Image URL" :error="addition.problems.url">
      <TextInput v-model="draft.url" v-bind="control" type="url" inputmode="url" spellcheck="false" autocomplete="off" wide />
    </Field>
    <RadioRow v-model="draft.fetching" class="fetching" :choices="FETCH_CHOICES" aria-label="Fetching" />
    <AddScreenFoot :running="addition.running" :changed="changed" :failure="addition.failure" />
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
