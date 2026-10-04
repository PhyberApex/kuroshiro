<script setup lang="ts">
import type { PluginPlace } from 'kuroshiro-shared'
import { RouterLink } from 'vue-router'
import Button from '@/components/Button.vue'
import { devicePath } from '@/pages/devices/devicePaths'
import PlaceRow from './PlaceRow.vue'

defineProps<{
  place: PluginPlace
  pluginName: string
}>()
</script>

<template>
  <PlaceRow>
    <template #name>
      {{ place.name }}
    </template>
    <template #standing>
      A Mashup on {{ place.deviceName }}. {{ pluginName }} fills one of its slots.
    </template>
    <template #act>
      <Button variant="quiet" as-child>
        <RouterLink :to="`${devicePath(place.deviceId)}?screen=${place.screenId}`">
          Open the Mashup
        </RouterLink>
      </Button>
    </template>
  </PlaceRow>
</template>
