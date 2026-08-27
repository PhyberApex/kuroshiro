<script setup lang="ts">
import { VCol, VRow, VSwitch, VTextField } from 'vuetify/components'

defineProps<{
  macRules: ((value: string) => true | string)[]
  apikeyRules: ((value: string) => true | string)[]
}>()

const mirrorEnabled = defineModel<boolean>('mirrorEnabled', { required: true })
const mirrorMac = defineModel<string>('mirrorMac', { required: true })
const mirrorApikey = defineModel<string>('mirrorApikey', { required: true })
</script>

<template>
  <VRow class="mb-2" density="comfortable">
    <VCol cols="12" sm="6" md="4">
      <VSwitch v-model="mirrorEnabled" color="secondary" label="Mirroring" />
    </VCol>
    <VCol cols="12" sm="6" md="4">
      <VTextField v-model="mirrorMac" density="compact" label="Mirror MAC address" :disabled="!mirrorEnabled" :rules="macRules" />
    </VCol>
    <VCol cols="12" sm="6" md="4">
      <VTextField v-model="mirrorApikey" density="compact" label="Mirror API key" :disabled="!mirrorEnabled" :rules="apikeyRules" />
    </VCol>
  </VRow>
</template>
