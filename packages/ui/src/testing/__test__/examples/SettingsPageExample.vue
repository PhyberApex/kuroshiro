<script setup lang="ts">
import type { ApiError, InstanceSettingsResponse } from 'kuroshiro-shared'
import { onMounted, ref } from 'vue'

const settings = ref<InstanceSettingsResponse>()
const refusal = ref<ApiError>()

onMounted(async () => {
  const response = await fetch(new URL('api/settings', document.baseURI))
  if (response.ok)
    settings.value = await response.json()
  else
    refusal.value = await response.json()
})
</script>

<template>
  <main>
    <h1>Settings</h1>
    <p v-if="settings">
      Low battery below {{ settings.lowBatteryPercent.value }} %
    </p>
    <p v-if="refusal" role="alert">
      Refused: {{ refusal.code }}
    </p>
  </main>
</template>
