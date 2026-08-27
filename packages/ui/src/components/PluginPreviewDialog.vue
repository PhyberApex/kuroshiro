<script setup lang="ts">
import type { RenderTarget } from '@/utils/screenShell'
import { viewFull } from 'kuroshiro-shared'
import { VAlert, VBtn, VCard, VCardActions, VCardText, VCardTitle, VDialog, VDivider, VSpacer, VTab, VTabs, VWindow, VWindowItem } from 'vuetify/components'
import RenderTargetPicker from '@/components/RenderTargetPicker.vue'
import ScreenFrame from '@/components/ScreenFrame.vue'

defineProps<{
  html: string
  data: Record<string, unknown> | null
  error: string
}>()

const show = defineModel<boolean>('show', { required: true })
const tab = defineModel<string>('tab', { required: true })
const target = defineModel<RenderTarget>('target', { required: true })
</script>

<template>
  <VDialog v-model="show" max-width="900px">
    <VCard>
      <VCardTitle>
        <span class="text-h6">Plugin Preview</span>
      </VCardTitle>
      <VDivider />
      <VCardText>
        <VAlert v-if="error" type="error" class="mb-4">
          {{ error }}
        </VAlert>
        <VTabs v-model="tab">
          <VTab value="rendered">
            Rendered Output
          </VTab>
          <VTab value="data">
            Fetched Data
          </VTab>
        </VTabs>
        <VWindow v-model="tab">
          <VWindowItem value="rendered">
            <div v-if="html" class="mt-4">
              <RenderTargetPicker v-model="target" class="mb-3" />
              <ScreenFrame :body="viewFull(html)" :target="target" />
            </div>
          </VWindowItem>
          <VWindowItem value="data">
            <pre class="mt-4 pa-4" style="background: #f5f5f5; color: #1a1a1a; border-radius: 4px; overflow: auto; max-height: 400px;">{{ JSON.stringify(data, null, 2) }}</pre>
          </VWindowItem>
        </VWindow>
      </VCardText>
      <VDivider />
      <VCardActions>
        <VSpacer />
        <VBtn variant="text" @click="show = false">
          Close
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
