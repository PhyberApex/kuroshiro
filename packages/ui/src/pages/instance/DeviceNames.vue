<script setup lang="ts">
import type { DeviceReference } from 'kuroshiro-shared'
import { RouterLink } from 'vue-router'
import { deviceSettingsPath } from '@/pages/devices/devicePaths'
import { SETTINGS_SECTIONS } from '@/pages/devices/deviceSettings'

const props = defineProps<{
  devices: DeviceReference[]
  /** The section of a Device's Settings each name leads to: where what the sentence is about is chosen. */
  section: keyof typeof SETTINGS_SECTIONS
}>()

/** "Kitchen", "Kitchen and Hallway", "Kitchen, Hallway and Study": what stands before the name at `index`. */
function joinBefore(index: number, count: number) {
  if (index === 0)
    return ''
  return index === count - 1 ? ' and ' : ', '
}

const settingsOf = (device: DeviceReference) => `${deviceSettingsPath(device.id)}#${SETTINGS_SECTIONS[props.section]}`
</script>

<template>
  <template v-for="(device, index) in devices" :key="device.id">
    {{ joinBefore(index, devices.length) }}<RouterLink class="device" :to="settingsOf(device)">
      {{ device.name }}
    </RouterLink>
  </template>
</template>

<style scoped>
@layer components {
  .device {
    text-underline-offset: 3px;
    transition: color var(--duration-quick) var(--ease-out);
  }

  .device:hover {
    color: var(--color-ink-hover);
  }
}
</style>
