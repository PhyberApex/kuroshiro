<script setup lang="ts">
import type { DeviceDetail, ScreenRead } from 'kuroshiro-shared'
import { computed, nextTick, ref, useId, useTemplateRef } from 'vue'
import { NOT_IN_DEMO } from '@/api/refusalWording'
import Button from '@/components/Button.vue'
import { useInstanceFacts } from '@/reads/sharedReads'
import ReplaceFile from './ReplaceFile.vue'
import { fileFacts } from './screenSourceWording'

const props = defineProps<{
  screen: ScreenRead
  file: NonNullable<ScreenRead['file']>
  device: DeviceDetail
  /** Reads the Screens again, after the image was replaced. */
  reload: () => Promise<void>
}>()

const instance = useInstanceFacts()
const demoNoteId = useId()
const opener = useTemplateRef('opener')

const replacing = ref(false)
const facts = computed(() => fileFacts(props.file, props.device))
const inDemo = computed(() => instance.data?.demoMode ?? false)

async function close() {
  replacing.value = false
  await nextTick()
  opener.value?.$el.focus()
}
</script>

<template>
  <ReplaceFile
    v-if="replacing && instance.data"
    :screen="screen"
    :device="device"
    :max-bytes="instance.data.limits.imageUploadBytes"
    :reload="reload"
    @close="close"
  />
  <template v-else>
    <p v-if="file.originalName" class="file-name">
      {{ file.originalName }}
    </p>
    <p v-if="facts" class="facts">
      {{ facts }}
    </p>
    <div class="replace">
      <Button ref="opener" :disabled="inDemo || !instance.data" :aria-describedby="inDemo ? demoNoteId : undefined" @click="replacing = true">
        Replace file
      </Button>
      <span v-if="inDemo" :id="demoNoteId" class="facts">{{ NOT_IN_DEMO }}</span>
    </div>
  </template>
</template>

<style scoped>
@layer components {
  .file-name {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }

  .facts {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .replace {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
  }
}
</style>
