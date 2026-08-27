<script setup lang="ts">
import type { RenderTarget } from '@/utils/screenShell'
import { useElementSize } from '@vueuse/core'
import { wrapInScreenShell } from 'kuroshiro-shared'
import { computed, ref } from 'vue'

const props = defineProps<{ body: string, target: RenderTarget }>()

const container = ref<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(container)

const scale = computed(() => containerWidth.value > 0 ? Math.min(1, containerWidth.value / props.target.model.width) : 1)
const srcdoc = computed(() => wrapInScreenShell(props.target, props.body))
</script>

<template>
  <div
    ref="container"
    class="screen-frame"
    :style="{ width: `min(90vw, ${target.model.width}px)`, maxWidth: `min(100%, ${target.model.width}px)`, height: `${Math.round(target.model.height * scale)}px` }"
    data-test-id="screen-frame"
  >
    <iframe
      :srcdoc="srcdoc"
      :width="target.model.width"
      :height="target.model.height"
      :style="{ transform: `scale(${scale})` }"
      class="screen-frame__iframe"
      title="Screen preview"
      sandbox="allow-scripts"
    />
  </div>
</template>

<style scoped>
.screen-frame {
  overflow: hidden;
  position: relative;
}

.screen-frame__iframe {
  display: block;
  border: 1px solid #ccc;
  transform-origin: top left;
  background: #fff;
}
</style>
