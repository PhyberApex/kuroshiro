<script setup lang="ts">
import type { ScreenRead } from 'kuroshiro-shared'
import type { FetchChoice } from './fetchChoices'
import { computed, ref, watch } from 'vue'
import { IMAGE_NOT_FETCHED } from '@/api/refusalWording'
import { refreshScreen, updateScreen } from '@/api/screens'
import Button from '@/components/Button.vue'
import { failureReason } from '@/components/failureReason'
import Field from '@/components/Field.vue'
import RadioRow from '@/components/RadioRow.vue'
import SaveState from '@/components/SaveState.vue'
import TextInput from '@/components/TextInput.vue'
import { useSaveAsChanged } from '@/components/useSaveAsChanged'
import RelativeTime from '@/patterns/RelativeTime.vue'
import { FETCH_CHOICES, fetchChoiceOf, NOT_A_WEB_ADDRESS } from './fetchChoices'
import { isWebAddress } from './screenSourceWording'

const props = defineProps<{
  screen: ScreenRead
  external: NonNullable<ScreenRead['external']>
  /** Reads the Screens again, after a write to this one. */
  reload: () => Promise<void>
}>()

const url = ref(props.external.url)
const choice = ref(fetchChoiceOf(props.external.fetchManual))
/** What is wrong with the address: it is no web address, or "Refresh image" could not fetch from it. */
const urlProblem = ref<string>()
const refreshing = ref(false)

async function save(input: { url: string } | { fetchManual: boolean }) {
  const saved = await updateScreen(props.screen.id, input)
  await props.reload()
  return saved.external
}

const urlSave = useSaveAsChanged(async entered => (await save({ url: entered.trim() }))?.url, url)
const choiceSave = useSaveAsChanged(async (chosen) => {
  const saved = await save({ fetchManual: chosen === 'keep' })
  return saved ? fetchChoiceOf(saved.fetchManual) : undefined
}, choice)

watch(() => props.external.url, (saved) => {
  if (urlSave.status !== 'saving')
    url.value = saved
})
watch(() => props.external.fetchManual, (saved) => {
  if (choiceSave.status !== 'saving')
    choice.value = fetchChoiceOf(saved)
})

/** A save that failed says why under the field, like an address that is refused before it is sent. */
const urlError = computed(() => urlProblem.value ?? (urlSave.status === 'failed' ? urlSave.reason : undefined))

function commitUrl() {
  urlProblem.value = isWebAddress(url.value) ? undefined : NOT_A_WEB_ADDRESS
  if (!urlProblem.value)
    urlSave.commit()
}

function choose(chosen: FetchChoice | undefined) {
  if (!chosen || chosen === choice.value)
    return
  choice.value = chosen
  choiceSave.commit()
}

async function refresh() {
  refreshing.value = true
  urlProblem.value = undefined
  try {
    await refreshScreen(props.screen.id)
    await props.reload()
  }
  catch (error) {
    urlProblem.value = failureReason(error) ?? IMAGE_NOT_FETCHED
  }
  finally {
    refreshing.value = false
  }
}
</script>

<template>
  <div class="fetching">
    <Field v-slot="{ control }" class="address" label="Image URL" :error="urlError">
      <TextInput v-model="url" v-bind="control" type="url" inputmode="url" spellcheck="false" wide @update:model-value="urlProblem = undefined" @commit="commitUrl" />
    </Field>
    <SaveState :status="urlSave.status" @retry="urlSave.retry" />
  </div>
  <div class="fetching">
    <RadioRow :model-value="choice" :choices="FETCH_CHOICES" aria-label="Fetching" @update:model-value="choose" />
    <SaveState :status="choiceSave.status" :reason="choiceSave.reason" @retry="choiceSave.retry" />
  </div>
  <div v-if="external.fetchManual" class="refresh">
    <Button :loading="refreshing" @click="refresh">
      Refresh image
    </Button>
    <p v-if="screen.renderedAt" class="fetched">
      Fetched <RelativeTime :at="screen.renderedAt" />
    </p>
  </div>
</template>

<style scoped>
@layer components {
  .address {
    justify-items: stretch;
    max-width: none;
  }

  .fetching {
    display: grid;
    gap: var(--space-1);
  }

  .refresh {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
  }

  .fetched {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
