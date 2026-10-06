<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import { ref } from 'vue'
import { regenerateApikey } from '@/api/devices'
import Button from '@/components/Button.vue'
import Confirmation from '@/components/Confirmation.vue'
import CopyValue from '@/components/CopyValue.vue'
import TuckedSection from '@/components/TuckedSection.vue'
import ReadRow from '@/patterns/ReadRow.vue'
import { useDeviceFrame } from './deviceFrame'
import { maskedKey, regenerateApikeyWording, SETTINGS_SECTIONS } from './deviceSettings'

const props = defineProps<{
  device: DeviceDetail
}>()

const frame = useDeviceFrame()
const revealed = ref(false)
const asking = ref(false)
const wording = () => regenerateApikeyWording(props.device.name)

const regenerate = () => regenerateApikey(props.device.id)

async function showNewKey() {
  await frame.device.reload()
  revealed.value = true
}
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
    <Button v-if="!device.isProxied" class="regenerate" variant="quiet" @click="asking = true">
      Regenerate now
    </Button>
    <Confirmation v-model:open="asking" :title="wording().title" confirm-label="Regenerate now" :action="regenerate" @confirmed="showNewKey">
      {{ wording().what }}
      <template #lost>
        {{ wording().lost }}
      </template>
      <template #stays>
        {{ wording().stays }}
      </template>
    </Confirmation>
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

  .regenerate {
    min-height: 0;
    margin-top: var(--space-2);
  }
}
</style>
