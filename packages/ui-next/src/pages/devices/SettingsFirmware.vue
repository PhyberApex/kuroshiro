<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import type { SettingsReference } from './deviceSettings'
import { RouterLink } from 'vue-router'
import { FIRMWARE_PATH } from '@/pages/instance/instancePaths'
import PageSection from '@/patterns/PageSection.vue'
import ReadRow from '@/patterns/ReadRow.vue'
import { SETTINGS_SECTIONS } from './deviceSettings'
import TargetFirmwareRow from './TargetFirmwareRow.vue'

defineProps<{
  device: DeviceDetail
  reference: SettingsReference
}>()
</script>

<template>
  <PageSection :id="SETTINGS_SECTIONS.firmware" title="Firmware" rows>
    <ReadRow label="Reported version">
      <code v-if="device.reported.firmwareVersion" class="version">{{ device.reported.firmwareVersion }}</code>
      <span v-else class="soft">Not reported yet</span>
    </ReadRow>
    <ReadRow v-if="device.isMirrored" label="Target Firmware">
      {{ device.isProxied ? 'Set by TRMNL' : 'Off while Mirroring' }}
    </ReadRow>
    <TargetFirmwareRow v-else :device="device" :firmware="reference.firmware" />
    <template #under>
      <span class="library">
        The
        <RouterLink v-slot="{ href, navigate }" custom :to="FIRMWARE_PATH">
          <a class="link" :href="href" @click="navigate">Firmware library</a>
        </RouterLink>
        lives under Instance.
      </span>
      {{ ' ' }}
      <span v-if="reference.firmwareAutoUpdate">Firmware Auto-Update is on: {{ device.name }} is given each new official Firmware by itself.</span>
      <span v-else>Firmware Auto-Update is off, so {{ device.name }} only updates when you press “Update now”.</span>
    </template>
  </PageSection>
</template>

<style scoped>
@layer components {
  .version {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .soft {
    color: var(--color-ink-soft);
  }

  .link {
    color: var(--color-ink);
    text-underline-offset: 3px;
    transition: color var(--duration-quick) var(--ease-out);
  }

  .link:hover {
    color: var(--color-ink-hover);
  }
}
</style>
