<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import { ref } from 'vue'
import Button from '@/components/Button.vue'
import CopyValue from '@/components/CopyValue.vue'
import TuckedSection from '@/components/TuckedSection.vue'
import ReadRow from '@/patterns/ReadRow.vue'
import { maskedKey, SETTINGS_SECTIONS } from './deviceSettings'

defineProps<{
  device: DeviceDetail
}>()

const revealed = ref(false)
</script>

<template>
  <TuckedSection :id="SETTINGS_SECTIONS.identity" title="Identity and credentials">
    <ReadRow label="Friendly id">
      <code class="friendly-id">{{ device.friendlyId }}</code>
    </ReadRow>
    <ReadRow label="MAC address">
      <CopyValue :value="device.mac" />
    </ReadRow>
    <ReadRow label="API key">
      <span class="key">
        <CopyValue :value="device.apikey">{{ revealed ? device.apikey : maskedKey(device.apikey) }}</CopyValue>
        <Button :aria-pressed="revealed" @click="revealed = !revealed">
          {{ revealed ? 'Hide' : 'Reveal' }}
        </Button>
      </span>
    </ReadRow>
  </TuckedSection>
</template>

<style scoped>
@layer components {
  .friendly-id {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .key {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
}
</style>
