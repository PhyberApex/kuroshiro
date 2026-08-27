<script setup lang="ts">
import type { RenderTarget } from '@/utils/screenShell'
import { viewFull } from 'kuroshiro-shared'
import { VOverlay } from 'vuetify/components'
import ScreenFrame from '@/components/ScreenFrame.vue'

defineProps<{
  modelValue: boolean
  html: string
  renderTarget: RenderTarget
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <VOverlay :model-value="modelValue" class="align-center justify-center" @update:model-value="emit('update:modelValue', $event)">
    <ScreenFrame v-if="modelValue" :body="viewFull(html)" :target="renderTarget" />
  </VOverlay>
</template>
