<script setup lang="ts">
import type { DeviceModelRead } from 'kuroshiro-shared'
import type { FirmwareDraft, UploadProblems } from './uploadFirmware'
import { computed, nextTick, reactive, ref, useId, watch } from 'vue'
import { useRouter } from 'vue-router'
import { uploadFirmware } from '@/api/firmware'
import { failureReason } from '@/components/failureReason'
import Field from '@/components/Field.vue'
import FieldError from '@/components/FieldError.vue'
import FileDrop from '@/components/FileDrop.vue'
import { formatBytes } from '@/components/fileRules'
import Icon from '@/components/Icon.vue'
import TextInput from '@/components/TextInput.vue'
import AddFormFoot from '@/patterns/AddFormFoot.vue'
import FirmwareFits from './FirmwareFits.vue'
import { FIRMWARE_PATH } from './instancePaths'
import { draftProblems, uploadInput, uploadRefusedAt } from './uploadFirmware'

const props = defineProps<{
  /** The Device Models a Firmware can be said to fit: the ones that are not deprecated. */
  models: DeviceModelRead[]
  /** The largest file the Instance takes. */
  maxBytes: number
}>()

const router = useRouter()

const draft = reactive<FirmwareDraft>({ file: null, version: '', label: '', fits: 'some', models: [] })
const problems = ref<UploadProblems>({})
const failure = ref<string>()
const uploading = ref(false)
const uploaded = ref(false)

const fileLabelId = useId()
const fileProblemId = useId()

const limit = computed(() => formatBytes(props.maxBytes))
const fileWording = computed(() => ({
  prompt: `Drop a .bin here, up to ${limit.value}.`,
  wrongType: 'A Firmware file ends in .bin.',
  tooLarge: (size: string) => `This file is ${size}. A Firmware can be up to ${limit.value}.`,
}))

const changed = computed(() => !uploaded.value
  && (draft.file !== null || draft.version.trim() !== '' || draft.label.trim() !== '' || draft.fits === 'all' || draft.models.length > 0))

const forget = (field: keyof UploadProblems) => () => (problems.value = { ...problems.value, [field]: undefined })
watch(() => draft.file, forget('file'))
watch(() => draft.version, forget('version'))
watch(() => [draft.fits, draft.models], forget('fits'))

async function upload() {
  failure.value = undefined
  problems.value = draftProblems(draft)
  if (Object.keys(problems.value).length > 0 || !draft.file)
    return
  uploading.value = true
  try {
    await uploadFirmware(draft.file, uploadInput(draft))
    uploaded.value = true
    await nextTick()
    await router.push(FIRMWARE_PATH)
  }
  catch (error) {
    problems.value = uploadRefusedAt(error, draft)
    if (Object.keys(problems.value).length === 0)
      failure.value = `Not uploaded. ${failureReason(error) ?? 'Something went wrong.'}`
  }
  finally {
    uploading.value = false
  }
}
</script>

<template>
  <form class="upload-form" novalidate @submit.prevent="upload">
    <div role="group" :aria-labelledby="fileLabelId">
      <p :id="fileLabelId" class="label">
        Firmware file
      </p>
      <FileDrop
        v-model="draft.file"
        :accept="['.bin']"
        :max-bytes="maxBytes"
        :wording="fileWording"
        :invalid="Boolean(problems.file)"
        :aria-describedby="problems.file ? fileProblemId : undefined"
      />
      <FieldError :id="fileProblemId" :message="problems.file" />
    </div>
    <Field
      v-slot="{ control }"
      class="wide"
      label="Version"
      hint="As the Firmware reports it. A Device shows this as its version once it runs it."
      :error="problems.version"
    >
      <TextInput v-model="draft.version" v-bind="control" class="version" autocomplete="off" spellcheck="false" />
    </Field>
    <Field
      v-slot="{ control }"
      class="wide"
      label="Label"
      optional
      hint="Told apart by this in a Device's Settings. Without one the file's name is used."
    >
      <TextInput v-model="draft.label" v-bind="control" prose wide autocomplete="off" />
    </Field>
    <FirmwareFits v-model:fits="draft.fits" v-model:ticked="draft.models" :models="models" :error="problems.fits" />
    <p class="warning">
      <Icon name="problem" class="mark" />
      <span>Kuroshiro cannot tell whether a file is working Firmware. A Device pushed a wrong one may not start again.</span>
    </p>
    <AddFormFoot button="Upload Firmware" :running="uploading" :changed="changed" :failure="failure" :cancel-to="FIRMWARE_PATH">
      Version, label and Device Models cannot be changed afterwards.
      <template #lost>
        What you entered for the new Firmware.
      </template>
    </AddFormFoot>
  </form>
</template>

<style scoped>
@layer components {
  .upload-form {
    display: grid;
    gap: var(--space-5);
    max-width: 34rem;
  }

  .label {
    padding-bottom: var(--space-1);
    font-weight: var(--weight-medium);
  }

  .upload-form .wide {
    max-width: none;
  }

  :deep(.version) {
    width: 12rem;
  }

  .warning {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    font-weight: var(--weight-medium);
  }

  .upload-form .mark {
    flex: none;
    margin-top: calc((1lh - var(--icon)) / 2);
  }
}
</style>
