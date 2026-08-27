<script setup lang="ts">
import { VCol, VRow, VSwitch, VTextField } from 'vuetify/components'

defineProps<{
  sleepWindowValid: boolean
  sleepWindowSpansMidnight: boolean
}>()

const sleepModeEnabled = defineModel<boolean>('sleepModeEnabled', { required: true })
const sleepStartTime = defineModel<string>('sleepStartTime', { required: true })
const sleepEndTime = defineModel<string>('sleepEndTime', { required: true })
const sleepScreenEnabled = defineModel<boolean>('sleepScreenEnabled', { required: true })
</script>

<template>
  <VRow class="mb-0" density="comfortable">
    <VCol cols="12" sm="6" md="3">
      <VSwitch v-model="sleepModeEnabled" color="secondary" label="Sleep Mode" data-test-id="sleep-mode-switch" />
    </VCol>
    <VCol cols="12" sm="6" md="3">
      <VTextField
        v-model="sleepStartTime"
        type="time"
        density="compact"
        label="Sleep window from"
        :error="!sleepWindowValid"
        :error-messages="!sleepWindowValid ? ['Set both a start and end time to enable Sleep Mode.'] : []"
        data-test-id="sleep-start-time"
      />
    </VCol>
    <VCol cols="12" sm="6" md="3">
      <VTextField
        v-model="sleepEndTime"
        type="time"
        density="compact"
        label="Sleep window to"
        :error="!sleepWindowValid"
        :error-messages="!sleepWindowValid ? ['Set both a start and end time to enable Sleep Mode.'] : []"
        data-test-id="sleep-end-time"
      />
    </VCol>
    <VCol cols="12" sm="6" md="3">
      <VSwitch v-model="sleepScreenEnabled" color="secondary" label="Show dedicated sleep screen" data-test-id="sleep-screen-switch" />
    </VCol>
    <VCol v-if="sleepWindowSpansMidnight" cols="12">
      <span class="text-caption text-medium-emphasis" data-test-id="sleep-window-midnight-hint">This window crosses midnight.</span>
    </VCol>
  </VRow>
</template>
