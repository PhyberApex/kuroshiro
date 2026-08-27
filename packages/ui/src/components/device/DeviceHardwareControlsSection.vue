<script setup lang="ts">
import { VBtn, VCol, VNumberInput, VRow, VSelect } from 'vuetify/components'

defineProps<{
  specialFunctionTriggering: boolean
  resetTriggering: boolean
}>()

defineEmits<{
  triggerSpecialFunction: []
  triggerReset: []
}>()

const refreshRateNumber = defineModel<number>('refreshRateNumber', { required: true })
const refreshRateUnit = defineModel<'hours' | 'minutes' | 'seconds'>('refreshRateUnit', { required: true })
const pendingSpecialFunction = defineModel<string>('pendingSpecialFunction', { required: true })

const specialFunctionalities = [
  { title: 'None', value: 'none' },
  { title: 'Identify', value: 'identify' },
  { title: 'Sleep', value: 'sleep' },
  { title: 'Add WiFi', value: 'add_wifi' },
  { title: 'Restart playlist (unavailable)', value: 'restart_playlist' },
  { title: 'Rewind', value: 'rewind' },
  { title: 'Send to me (unavailable)', value: 'send_to_me' },
]
</script>

<template>
  <VRow class="mb-2" density="comfortable">
    <VCol cols="12" sm="12" md="6" lg="4">
      <VRow>
        <VCol cols="12" sm="5">
          <VNumberInput v-model="refreshRateNumber" control-variant="hidden" type="number" density="compact" label="Refresh Rate" />
        </VCol>
        <VCol cols="12" sm="7">
          <VSelect v-model="refreshRateUnit" density="compact" label="Unit" :items="['hours', 'minutes', 'seconds']" />
        </VCol>
      </VRow>
    </VCol>
    <VCol cols="12" sm="8" md="6" class="d-flex align-center ga-3">
      <VSelect
        v-model="pendingSpecialFunction"
        :items="specialFunctionalities"
        density="compact"
        label="Special Function"
        data-test-id="device-special-function-select"
      />
      <VBtn
        size="small"
        color="secondary"
        variant="tonal"
        :loading="specialFunctionTriggering"
        :disabled="pendingSpecialFunction === 'none'"
        data-test-id="device-special-function-trigger-btn"
        @click="$emit('triggerSpecialFunction')"
      >
        Trigger
      </VBtn>
    </VCol>
    <VCol cols="12" sm="4" md="6" class="d-flex align-center">
      <VBtn
        size="small"
        color="secondary"
        variant="tonal"
        :loading="resetTriggering"
        data-test-id="device-reset-trigger-btn"
        @click="$emit('triggerReset')"
      >
        Reset device
      </VBtn>
    </VCol>
  </VRow>
</template>
