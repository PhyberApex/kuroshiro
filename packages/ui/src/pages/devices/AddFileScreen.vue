<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import { computed, ref, useId, watch } from 'vue'
import { isRefusal } from '@/api/client'
import { createFileScreen } from '@/api/screens'
import FieldError from '@/components/FieldError.vue'
import FileDrop from '@/components/FileDrop.vue'
import { useInstanceFacts } from '@/reads/sharedReads'
import { nameFromFile } from './addScreen'
import AddScreenFoot from './AddScreenFoot.vue'
import { useAddScreen } from './addScreenForm'
import { IMAGE_ENDINGS, IMAGE_FORMATS } from './imageFiles'
import ScreenNameField from './ScreenNameField.vue'
import { screenNameProblem } from './screenNaming'
import { rendersFor } from './screenSourceWording'

const props = defineProps<{
  device: DeviceDetail
}>()

const facts = useInstanceFacts()
const addition = useAddScreen(['name', 'file'])

const labelId = useId()
const problemId = useId()

const name = ref('')
/** The name the last chosen file gave the Screen. While the field still holds it, another file renames the Screen. */
const nameOfFile = ref('')
const file = ref<File | null>(null)

const maxBytes = computed(() => facts.data?.limits.imageUploadBytes)
const convertedFor = computed(() => rendersFor(props.device))
const changed = computed(() => !addition.added && (name.value.trim() !== '' || file.value !== null))

watch(file, (chosen) => {
  addition.problems = { ...addition.problems, file: undefined }
  if (chosen && (name.value.trim() === '' || name.value === nameOfFile.value))
    name.value = nameOfFile.value = nameFromFile(chosen.name)
})

/** A file the server cannot take is a problem of the file: the Screen is not added and the drop zone says why. */
function notTaken(error: unknown) {
  return isRefusal(error, 'image-unreadable') || isRefusal(error, 'upload-too-large') ? { file: error.message } : {}
}

function add() {
  const chosen = file.value
  void addition.create(() => createFileScreen({ deviceId: props.device.id, name: name.value.trim() }, chosen!), {
    name: screenNameProblem(name.value),
    file: chosen ? undefined : 'Choose an image to upload.',
  }, notTaken)
}
</script>

<template>
  <form class="add-file-screen" novalidate @submit.prevent="add">
    <ScreenNameField v-model="name" :error="addition.problems.name" />
    <div role="group" :aria-labelledby="labelId">
      <p :id="labelId" class="label">
        Image
      </p>
      <FileDrop
        v-if="maxBytes !== undefined"
        v-model="file"
        :accept="IMAGE_ENDINGS"
        :max-bytes="maxBytes"
        prompt="Drop an image here."
        :formats="IMAGE_FORMATS"
        :invalid="Boolean(addition.problems.file)"
        :aria-describedby="addition.problems.file ? problemId : undefined"
      />
      <FieldError :id="problemId" :message="addition.problems.file" />
      <p v-if="convertedFor" class="converted">
        It is converted for {{ convertedFor }}.
      </p>
    </div>
    <AddScreenFoot :running="addition.running" :changed="changed" :failure="addition.failure" />
  </form>
</template>

<style scoped>
@layer components {
  .add-file-screen {
    display: grid;
    gap: var(--space-4);
  }

  .label {
    padding-bottom: var(--space-1);
    font-weight: var(--weight-medium);
  }

  .converted {
    padding-top: var(--space-1);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
