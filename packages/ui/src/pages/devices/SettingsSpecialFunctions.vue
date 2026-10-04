<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import { computed, ref, watch } from 'vue'
import Button from '@/components/Button.vue'
import ResultLine from '@/components/ResultLine.vue'
import SaveState from '@/components/SaveState.vue'
import TuckedSection from '@/components/TuckedSection.vue'
import { useNow } from '@/patterns/useNow'
import { OFFERED_SPECIAL_FUNCTIONS, reachesDevice, SETTINGS_SECTIONS } from './deviceSettings'
import SettingsProblem from './SettingsProblem.vue'
import { useDeviceWrite } from './useDeviceSetting'

const props = defineProps<{
  device: DeviceDetail
}>()

const now = useNow()
const write = useDeviceWrite()

const pending = computed(() => props.device.pending.specialFunction)
const cannotTrigger = computed(() => pending.value !== null || props.device.isProxied || write.status === 'saving')

const open = ref(pending.value !== null)
watch(pending, (waiting) => {
  if (waiting)
    open.value = true
})
</script>

<template>
  <TuckedSection :id="SETTINGS_SECTIONS.specialFunctions" v-model:open="open" title="Special Functions">
    <p class="intro">
      A one-shot command that reaches {{ device.name }} at its next poll and fires once. The <code class="mono">sleep</code> Special Function is separate from Sleep Mode.
    </p>
    <ul class="functions">
      <li v-for="offered in OFFERED_SPECIAL_FUNCTIONS" :key="offered.name" class="function">
        <code class="name mono">{{ offered.name }}</code>
        <div class="does">
          <ResultLine :running="pending === offered.name">
            <template v-if="pending === offered.name" #default>
              Pending, {{ reachesDevice(device, now) }}
            </template>
          </ResultLine>
          <span v-if="pending !== offered.name">{{ offered.does }}</span>
        </div>
        <Button :aria-label="`Trigger ${offered.name}`" :disabled="cannotTrigger" @click="write.send({ specialFunction: offered.name })">
          Trigger
        </Button>
      </li>
    </ul>
    <SettingsProblem v-if="device.isProxied">
      {{ device.name }} is a Proxied Device. TRMNL answers its polls, so a Special Function triggered here never reaches it.
    </SettingsProblem>
    <SaveState class="state" :status="write.status" :reason="write.reason" @retry="write.retry" />
  </TuckedSection>
</template>

<style scoped>
@layer components {
  .intro {
    max-width: var(--measure);
    color: var(--color-ink-soft);
  }

  .mono {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .functions {
    margin-top: var(--space-3);
  }

  .function {
    display: grid;
    grid-template-columns: 8.5rem minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-1) var(--space-4);
    min-height: 3.25rem;
    padding: var(--space-2) 0;
    border-bottom: var(--rule);
  }

  .does {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .state {
    margin-top: var(--space-3);
  }

  @media (max-width: 820px) {
    .function {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .does {
      grid-row: 2;
      grid-column: 1 / -1;
    }
  }
}
</style>
