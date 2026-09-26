<script setup lang="ts">
import type { Plugin } from '@/types/plugin'
import { VCol, VRow } from 'vuetify/components'
import PluginCard from './PluginCard.vue'

defineProps<{
  plugins: Plugin[]
}>()

const emit = defineEmits<{
  assignmentsChanged: []
  duplicated: []
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
      <PluginCard :plugin="plugin" @assignments-changed="emit('assignmentsChanged')" @duplicated="emit('duplicated')" @deleted="emit('deleted')" />
    </VCol>
  </VRow>
</template>
