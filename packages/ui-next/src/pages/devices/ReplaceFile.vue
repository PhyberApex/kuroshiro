<script setup lang="ts">
import type { DeviceDetail, ScreenRead } from 'kuroshiro-shared'
import { nextTick, onBeforeUnmount, onMounted, ref, useId, useTemplateRef, watch } from 'vue'
import { imageUrl } from '@/api/client'
import { previewScreenImage, replaceScreenImage } from '@/api/screens'
import Button from '@/components/Button.vue'
import { failureReason } from '@/components/failureReason'
import FieldError from '@/components/FieldError.vue'
import FileDrop from '@/components/FileDrop.vue'
import Plate from '@/components/Plate.vue'
import ResultLine from '@/components/ResultLine.vue'
import InPlaceForm from './InPlaceForm.vue'
import { screenName } from './screenNaming'

const props = defineProps<{
  screen: ScreenRead
  device: DeviceDetail
  /** The largest image this Instance takes, in bytes. */
  maxBytes: number
  /** Reads the Screens again, after the image was replaced. */
  reload: () => Promise<void>
}>()

const emit = defineEmits<{
  /** The form is done with: the image was replaced, or the current one is kept. */
  close: []
}>()

/** The endings of the six formats the server reads. */
const IMAGE_ENDINGS = ['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.tif', '.tiff', '.webp']

const inputId = useId()
const keep = useTemplateRef('keep')

const chosen = ref<File | null>(null)
/** The chosen file as the server converted it for the Device, as an address the browser holds. */
const converted = ref<string>()
const converting = ref(false)
const replacing = ref(false)
const problem = ref<string>()

function dropConverted() {
  if (converted.value)
    URL.revokeObjectURL(converted.value)
  converted.value = undefined
}

watch(chosen, async (file) => {
  dropConverted()
  problem.value = undefined
  if (!file)
    return
  converting.value = true
  try {
    const image = await previewScreenImage(props.screen.id, file)
    if (chosen.value !== file)
      return
    converted.value = URL.createObjectURL(image)
    await nextTick()
    keep.value?.$el.focus()
  }
  catch (error) {
    if (chosen.value !== file)
      return
    chosen.value = null
    await nextTick()
    problem.value = failureReason(error) ?? 'The file could not be converted.'
  }
  finally {
    converting.value = false
  }
})

async function replace() {
  if (!chosen.value)
    return
  replacing.value = true
  problem.value = undefined
  try {
    await replaceScreenImage(props.screen.id, chosen.value)
    await props.reload()
    emit('close')
  }
  catch (error) {
    problem.value = failureReason(error) ?? 'The image could not be replaced.'
  }
  finally {
    replacing.value = false
  }
}

onMounted(() => document.getElementById(inputId)?.focus())
onBeforeUnmount(dropConverted)
</script>

<template>
  <InPlaceForm title="Replace file">
    <template v-if="chosen && converted">
      <div class="compare">
        <figure>
          <Plate
            :name="`${screenName(screen.name)}, as it is now`"
            :src="screen.imagePath && imageUrl(screen.imagePath)"
            :width="device.deviceModel?.width"
            :height="device.deviceModel?.height"
          />
          <figcaption class="caption">
            Now
          </figcaption>
        </figure>
        <figure>
          <Plate
            :name="`${chosen.name}, converted for ${device.name}`"
            :src="converted"
            :width="device.deviceModel?.width"
            :height="device.deviceModel?.height"
          />
          <figcaption class="caption">
            New: {{ chosen.name }}
          </figcaption>
        </figure>
      </div>
      <p class="note">
        The current image is deleted. The Screen keeps its name, its Order and its Schedule.
      </p>
      <FieldError :message="problem" />
      <div class="buttons">
        <Button variant="primary" :loading="replacing" @click="replace">
          Replace image
        </Button>
        <Button ref="keep" variant="quiet" :disabled="replacing" @click="$emit('close')">
          Keep the current image
        </Button>
      </div>
    </template>
    <template v-else>
      <FileDrop
        :id="inputId"
        v-model="chosen"
        :accept="IMAGE_ENDINGS"
        :max-bytes="maxBytes"
        prompt="Drop an image here."
        formats="PNG, JPEG, BMP, GIF, TIFF or WebP"
        :disabled="converting"
        :invalid="Boolean(problem)"
      />
      <FieldError :message="problem" />
      <ResultLine :running="converting">
        <template v-if="converting && chosen" #default>
          Converting {{ chosen.name }} for {{ device.name }}
        </template>
      </ResultLine>
      <div class="buttons">
        <Button variant="quiet" @click="$emit('close')">
          Cancel
        </Button>
      </div>
    </template>
  </InPlaceForm>
</template>

<style scoped>
@layer components {
  .compare {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }

  .caption {
    margin-top: var(--space-1);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }

  .note {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
  }
}
</style>
