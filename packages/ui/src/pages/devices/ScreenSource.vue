<script setup lang="ts">
import type { DeviceDetail, ScreenRead } from 'kuroshiro-shared'
import { useId } from 'vue'
import { SCREEN_KIND_LABELS } from '@/components/screenRows'
import ExternalScreenSource from './ExternalScreenSource.vue'
import FileScreenSource from './FileScreenSource.vue'
import HtmlScreenSource from './HtmlScreenSource.vue'
import MashupScreenSource from './MashupScreenSource.vue'
import PluginScreenSource from './PluginScreenSource.vue'

defineProps<{
  screen: ScreenRead
  device: DeviceDetail
  /** Reads the Screens again, after a write to this one. */
  reload: () => Promise<void>
}>()

defineEmits<{
  /** What the Screen is made from changed, so its image is of what it was before until it is rendered again. */
  rerendering: []
}>()

const headingId = useId()
</script>

<template>
  <div class="screen-source" role="group" :aria-labelledby="headingId">
    <h4 :id="headingId" class="kind">
      {{ SCREEN_KIND_LABELS[screen.kind] }}
    </h4>
    <PluginScreenSource v-if="screen.plugin" :plugin="screen.plugin" :rendered-at="screen.renderedAt" />
    <MashupScreenSource v-else-if="screen.kind === 'mashup'" :screen="screen" :mashup="screen.mashup" :reload="reload" @changed="$emit('rerendering')" />
    <FileScreenSource v-else-if="screen.file" :screen="screen" :file="screen.file" :device="device" :reload="reload" />
    <ExternalScreenSource v-else-if="screen.external" :screen="screen" :external="screen.external" :reload="reload" />
    <HtmlScreenSource v-else-if="screen.kind === 'html'" :screen="screen" />
  </div>
</template>

<style scoped>
@layer components {
  .screen-source {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
  }

  .kind {
    margin: 0;
    font-weight: var(--weight-semibold);
    font-size: var(--text-md);
  }
}
</style>
