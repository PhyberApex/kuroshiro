<script setup lang="ts">
import type { RenderTarget } from '@/utils/screenShell'
import { useElementSize } from '@vueuse/core'
import { computed, ref } from 'vue'
import { wrapInScreenShell } from '@/utils/screenShell'

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
    :style="{ maxWidth: `${target.model.width}px`, height: `${Math.round(target.model.height * scale)}px` }"
    data-test-id="screen-frame"
  >
    <iframe
      :srcdoc="srcdoc"
      :width="target.model.width"
      :height="target.model.height"
      :style="{ transform: `scale(${scale})` }"
      class="screen-frame__iframe"
      title="Screen preview"
    />
  </div>
</template>

<style scoped>
.screen-frame {
  width: 100%;
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
