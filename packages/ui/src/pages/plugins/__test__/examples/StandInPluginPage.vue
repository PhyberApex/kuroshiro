<script setup lang="ts">
import PluginFrame from '../../PluginFrame.vue'
import PluginNaming from '../../PluginNaming.vue'
import StandInSection from './StandInSection.vue'
</script>

<template>
  <PluginFrame plugin-id="weather">
    <StandInSection />
    <template #tucked>
      <PluginNaming />
    </template>
  </PluginFrame>
</template>
