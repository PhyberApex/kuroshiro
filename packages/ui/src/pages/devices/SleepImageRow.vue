<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import { imageUrl } from '@/api/client'
import { removeSleepImage, uploadSleepImage } from '@/api/devices'
import { NOT_IN_DEMO } from '@/api/refusalWording'
import Button from '@/components/Button.vue'
import Confirmation from '@/components/Confirmation.vue'
import FileDrop from '@/components/FileDrop.vue'
import Plate from '@/components/Plate.vue'
import SettingRow from '@/components/SettingRow.vue'
import { useSaveAsChanged } from '@/components/useSaveAsChanged'
import { useInstanceFacts } from '@/reads/sharedReads'
import { IMAGE_ENDINGS, IMAGE_FORMATS } from './imageFiles'
import { possessive } from './screenNaming'

const props = defineProps<{
  device: DeviceDetail
}>()

const instance = useInstanceFacts()
const demoNoteId = useId()
const opener = useTemplateRef('opener')

const sleepImagePath = ref(props.device.sleepImagePath)
watch(() => props.device.sleepImagePath, path => sleepImagePath.value = path)

const inDemo = computed(() => instance.data?.demoMode ?? false)
const maxBytes = computed(() => instance.data?.limits.imageUploadBytes)

/** Shared by "Upload an image" and "Replace": both open the same file chooser and are disabled the same way in demo mode. */
const openerProps = computed(() => ({
  'disabled': inDemo.value || !instance.data,
  'aria-describedby': inDemo.value ? demoNoteId : undefined,
}))

const choosing = ref(false)
const file = ref<File | null>(null)
const asking = ref(false)

const upload = useSaveAsChanged<File | null>(async (chosen) => {
  if (!chosen)
    return
  const detail = await uploadSleepImage(props.device.id, chosen)
  sleepImagePath.value = detail.sleepImagePath
  choosing.value = false
  file.value = null
}, file)

const uploading = computed(() => upload.status === 'saving')

watch(file, chosen => chosen && upload.commit())

async function close() {
  choosing.value = false
  file.value = null
  await nextTick()
  opener.value?.$el.focus()
}

async function remove() {
  const detail = await removeSleepImage(props.device.id)
  sleepImagePath.value = detail.sleepImagePath
}
</script>

<template>
  <SettingRow label="Sleep image" :status="upload.status" :reason="upload.reason" @retry="upload.retry">
    <template #default>
      <template v-if="choosing">
        <FileDrop
          v-if="maxBytes !== undefined"
          v-model="file"
          :accept="IMAGE_ENDINGS"
          :max-bytes="maxBytes"
          prompt="Drop an image here."
          :formats="IMAGE_FORMATS"
          :disabled="uploading"
        />
        <Button variant="quiet" :disabled="uploading" @click="close">
          Cancel
        </Button>
      </template>
      <template v-else-if="sleepImagePath">
        <div class="plate-frame">
          <Plate
            :name="`${possessive(device.name)} sleep image`"
            :src="imageUrl(sleepImagePath)"
            :width="device.deviceModel?.width"
            :height="device.deviceModel?.height"
          />
        </div>
        <Button ref="opener" v-bind="openerProps" @click="choosing = true">
          Replace
        </Button>
        <Button variant="quiet" @click="asking = true">
          Remove
        </Button>
      </template>
      <template v-else>
        <Button ref="opener" v-bind="openerProps" @click="choosing = true">
          Upload an image
        </Button>
      </template>
      <span v-if="inDemo" :id="demoNoteId" class="facts">{{ NOT_IN_DEMO }}</span>
    </template>
    <template #note>
      <template v-if="sleepImagePath">
        Shown instead of the sleep Fallback Screen.
      </template>
      <template v-else>
        Optional. Without one, {{ device.name }} shows the sleep Fallback Screen.
      </template>
    </template>
  </SettingRow>
  <Confirmation
    v-model:open="asking"
    :title="`Remove ${possessive(device.name)} sleep image?`"
    confirm-label="Remove"
    :action="remove"
  >
    <template #lost>
      The uploaded sleep image.
    </template>
    <template #stays>
      Sleep Mode, which shows the sleep Fallback Screen again.
    </template>
  </Confirmation>
</template>

<style scoped>
@layer components {
  .plate-frame {
    width: 7.5rem;
  }

  .facts {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
