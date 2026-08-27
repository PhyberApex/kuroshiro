<script setup lang="ts">
import type { Screen } from '@/types'
import type { RenderTarget } from '@/utils/screenShell'
import { computed } from 'vue'
import { VAlert, VBtn, VCard, VCardActions, VCardText, VCardTitle, VDialog, VDivider, VSpacer } from 'vuetify/components'
import ScreenFrame from '@/components/ScreenFrame.vue'
import { cacheBustedUrl } from '@/utils/cacheBustedUrl'
import { viewFull } from '@/utils/screenShell'

const props = defineProps<{
  modelValue: boolean
  screen: Screen | null
  mode: 'html' | 'image' | 'plugin' | 'mashup'
  renderTarget: RenderTarget
  deviceId: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const title = computed(() => {
  const { screen } = props
  if (!screen)
    return ''
  return screen.plugin ? `Plugin: ${screen.plugin.name}` : screen.filename || 'Screen Preview'
})

const isCachedOutputMode = computed(() => props.mode === 'mashup' || props.mode === 'plugin')

const cachedOutputBody = computed(() => {
  const output = props.screen?.cachedPluginOutput
  if (!output)
    return null
  return props.mode === 'plugin' ? viewFull(output) : output
})

const cachedOutputMessage = computed(() => props.mode === 'plugin'
  ? 'Plugin output will be generated when a device requests it or when the scheduler runs.'
  : 'Mashup output will be generated when a device requests it or when the scheduler runs.')

const htmlBody = computed(() => props.mode === 'html' && props.screen?.html ? viewFull(props.screen.html) : null)

const imageSrc = computed(() => props.screen
  ? cacheBustedUrl(`/screens/devices/${props.deviceId}/${props.screen.id}.png`, props.screen.generatedAt)
  : '')
</script>

<template>
  <VDialog
    :model-value="modelValue"
    :max-width="`min(90vw, ${Math.max(900, renderTarget.model.width + 48)}px)`"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <VCard v-if="screen">
      <VCardTitle>
        {{ title }}
      </VCardTitle>
      <VDivider />
      <VCardText class="d-flex flex-column align-center pa-4">
        <!-- Mashup/plugin screens: show cached HTML if available, else show message -->
        <div v-if="isCachedOutputMode" class="w-100">
          <div v-if="cachedOutputBody" class="mb-4">
            <ScreenFrame :body="cachedOutputBody" :target="renderTarget" />
          </div>
          <VAlert v-else type="info" variant="tonal">
            {{ cachedOutputMessage }}
          </VAlert>
        </div>

        <!-- HTML screens -->
        <div v-else-if="htmlBody" class="w-100">
          <ScreenFrame :body="htmlBody" :target="renderTarget" />
        </div>

        <!-- Image screens -->
        <div v-else>
          <img
            :src="imageSrc"
            style="max-width: 100%; height: auto; border: 1px solid #ccc;"
            alt="Screen preview"
            @error="($event.target as HTMLImageElement).src = '/screens/error.png'"
          >
        </div>
      </VCardText>
      <VDivider />
      <VCardActions>
        <VSpacer />
        <VBtn variant="text" @click="emit('update:modelValue', false)">
          Close
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
