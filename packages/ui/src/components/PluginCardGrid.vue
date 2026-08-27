<script setup lang="ts">
import type { Plugin } from '@/types/plugin'
import { VCol, VRow } from 'vuetify/components'
import PluginCard from './PluginCard.vue'

defineProps<{
  plugins: Plugin[]
  deviceId?: string
}>()

const emit = defineEmits<{
  assignmentsChanged: []
  deleted: []
}>()
</script>

<template>
  <VRow>
    <VCol
      v-for="plugin in plugins"
      :key="plugin.id"
      cols="12"
      md="6"
      lg="4"
    >
      <PluginCard :plugin="plugin" :device-id="deviceId" @assignments-changed="emit('assignmentsChanged')" @deleted="emit('deleted')" />
    </VCol>
  </VRow>
</template>
