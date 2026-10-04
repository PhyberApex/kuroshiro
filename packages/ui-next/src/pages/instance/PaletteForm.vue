<script setup lang="ts">
import type { CustomPaletteFrameworkClass, PaletteRead } from 'kuroshiro-shared'
import type { PaletteDraft, PaletteProblems } from './paletteForm'
import { computed, nextTick, reactive, ref, useId, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { createPalette, updatePalette } from '@/api/device-models'
import Button from '@/components/Button.vue'
import ColourRow from '@/components/ColourRow.vue'
import { failureReason, notSavedSentence } from '@/components/failureReason'
import Field from '@/components/Field.vue'
import FieldError from '@/components/FieldError.vue'
import Icon from '@/components/Icon.vue'
import Select from '@/components/Select.vue'
import TextInput from '@/components/TextInput.vue'
import AddFormFoot from '@/patterns/AddFormFoot.vue'
import { DEVICE_MODELS_PATH } from './instancePaths'
import { draftOf, draftProblems, familyOptions, nextDraftColours, paletteInput, paletteRefusedAt, savingConverts } from './paletteForm'

const props = defineProps<{
  /** The custom Palette being changed; left out, a new one is added. */
  palette?: PaletteRead
  /** Every Palette: TRMNL's give a new one its first colours. */
  palettes: PaletteRead[]
}>()

const emit = defineEmits<{
  /** The Palette was added or changed: what the page shows is to be read again. */
  saved: []
}>()

const router = useRouter()

const initial = draftOf(props.palette, props.palettes)
const draft = reactive<PaletteDraft>(draftOf(props.palette, props.palettes))
const problems = ref<PaletteProblems>({ invalidColours: [] })
const failure = ref<string>()
const saving = ref(false)
const saved = ref(false)

const coloursLabelId = useId()
const coloursHintId = useId()
const coloursErrorId = useId()
const colourList = useTemplateRef('colourList')
const addColourButton = useTemplateRef('addColourButton')

const title = computed(() => props.palette ? `Edit ${props.palette.name}` : 'New custom Palette')
const inUse = computed(() => (props.palette?.usedBy.length ?? 0) > 0)
const familyHint = computed(() => `The inks the panel has. It decides which Device Models can use this Palette${inUse.value ? ', and cannot be changed while a Device uses it' : ''}.`)
const converts = computed(() => savingConverts(props.palette?.usedBy ?? []))
const changed = computed(() => !saved.value && JSON.stringify(draft) !== JSON.stringify(initial))

const family = computed({
  get: () => draft.frameworkClass,
  set: (next: CustomPaletteFrameworkClass | null) => {
    if (!next)
      return
    draft.colours = nextDraftColours(draft, next, props.palettes)
    draft.frameworkClass = next
  },
})

watch(() => draft.name, () => (problems.value = { ...problems.value, name: undefined }))
watch(() => [...draft.colours], () => (problems.value = { ...problems.value, colours: undefined, invalidColours: [] }))

const colourInputs = () => [...colourList.value?.querySelectorAll('input') ?? []]

async function addColour() {
  draft.colours.push('')
  await nextTick()
  colourInputs().at(-1)?.focus()
}

/** The rows are keyed by place, so the button that had the focus now removes the next colour; after the last one the focus goes to "Add a colour". */
async function removeColour(index: number) {
  draft.colours.splice(index, 1)
  await nextTick()
  if (index >= draft.colours.length)
    (addColourButton.value?.$el as HTMLElement | undefined)?.focus()
}

async function save() {
  failure.value = undefined
  problems.value = draftProblems(draft)
  if (problems.value.name || problems.value.colours)
    return
  saving.value = true
  try {
    const input = paletteInput(draft)
    await (props.palette ? updatePalette(props.palette.id, input) : createPalette(input))
    saved.value = true
    emit('saved')
    await nextTick()
    await router.push(DEVICE_MODELS_PATH)
  }
  catch (error) {
    problems.value = paletteRefusedAt(error, draft)
    if (!problems.value.name && !problems.value.colours) {
      const reason = failureReason(error) ?? 'Something went wrong.'
      failure.value = props.palette ? notSavedSentence(reason) : `Not added. ${reason}`
    }
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="palette-form" novalidate :aria-label="title" @submit.prevent="save">
    <Field v-slot="{ control }" class="wide" label="Name" :error="problems.name">
      <TextInput v-model="draft.name" v-bind="control" prose wide autocomplete="off" />
    </Field>
    <Field v-slot="{ control }" class="wide" label="Palette Family" :hint="familyHint">
      <Select v-model="family" v-bind="control" class="family" :options="familyOptions()" :disabled="inUse" />
    </Field>
    <div class="colours" role="group" :aria-labelledby="coloursLabelId">
      <p :id="coloursLabelId" class="label">
        Colours
      </p>
      <ul ref="colourList" class="colour-list">
        <li v-for="(_, index) in draft.colours" :key="index">
          <ColourRow
            v-model="draft.colours[index]!"
            :label="`Colour ${index + 1}`"
            :invalid="problems.invalidColours.includes(index)"
            :aria-describedby="problems.colours ? coloursErrorId : coloursHintId"
            @remove="removeColour(index)"
          />
        </li>
      </ul>
      <span>
        <Button ref="addColourButton" @click="addColour">
          <Icon name="plus" />Add a colour
        </Button>
      </span>
      <p v-if="!problems.colours" :id="coloursHintId" class="hint">
        One per ink, as <code>#RRGGBB</code>: the colour the panel really shows, not the ideal one. An image is reduced to exactly these.
      </p>
      <FieldError :id="coloursErrorId" :message="problems.colours" />
    </div>
    <AddFormFoot :button="palette ? 'Save Palette' : 'Add Palette'" :running="saving" :changed="changed" :failure="failure" :cancel-to="DEVICE_MODELS_PATH">
      <template v-if="converts" #default>
        {{ converts }}
      </template>
      <template #lost>
        {{ palette ? `Your changes to the Palette ${palette.name}.` : 'What you entered for the new Palette.' }}
      </template>
    </AddFormFoot>
  </form>
</template>

<style scoped>
@layer components {
  .palette-form {
    display: grid;
    gap: var(--space-5);
    max-width: 34rem;
  }

  .palette-form .wide {
    max-width: none;
  }

  .palette-form :deep(.family) {
    width: 100%;
  }

  .colours {
    display: grid;
    justify-items: start;
    gap: var(--space-2);
  }

  .label {
    font-weight: var(--weight-medium);
  }

  .colour-list {
    display: grid;
    gap: var(--space-2);
  }

  .hint {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    text-wrap: pretty;
  }

  code {
    font-family: var(--font-mono);
  }
}
</style>
