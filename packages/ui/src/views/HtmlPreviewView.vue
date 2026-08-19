<script setup lang="ts">
import type { RenderTarget } from '@/utils/screenShell'
import { refDebounced } from '@vueuse/core'
import { ref } from 'vue'
import { VCol, VContainer, VRow, VTextarea } from 'vuetify/components'
import RenderTargetPicker from '@/components/RenderTargetPicker.vue'
import ScreenFrame from '@/components/ScreenFrame.vue'
import exampleHtml from '@/utils/exampleHtml'
import { DEFAULT_MODEL, DEFAULT_PALETTE } from '@/utils/renderTarget'
import { viewFull } from '@/utils/screenShell'

const html = ref(exampleHtml)
const debouncedHtml = refDebounced(html, 300)
const target = ref<RenderTarget>({ model: DEFAULT_MODEL, palette: DEFAULT_PALETTE })
</script>

<template>
  <VContainer fluid>
    <VRow justify="center">
      <VCol cols="12" sm="12" md="12" lg="6">
        <VTextarea v-model="html" label="HTML to render" auto-grow />
      </VCol>
      <VCol cols="12" sm="12" md="12" lg="6">
        <RenderTargetPicker v-model="target" class="mb-3" />
        <ScreenFrame :body="viewFull(debouncedHtml)" :target="target" />
      </VCol>
    </VRow>
  </VContainer>
</template>
