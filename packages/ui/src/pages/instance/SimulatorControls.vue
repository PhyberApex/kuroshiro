<script setup lang="ts">
import type { DeviceSummary } from 'kuroshiro-shared'
import { computed } from 'vue'
import Button from '@/components/Button.vue'
import Field from '@/components/Field.vue'
import Notice from '@/components/Notice.vue'
import Select from '@/components/Select.vue'
import TextInput from '@/components/TextInput.vue'
import { madeUpMac } from '@/pages/devices/madeUpMac'
import SentenceLine from '@/pages/devices/SentenceLine.vue'
import { NOT_REGISTERED, useSimulator } from './deviceSimulator'
import SimulatorCalls from './SimulatorCalls.vue'
import SimulatorReports from './SimulatorReports.vue'
import { callConsequence } from './simulatorWording'

const props = defineProps<{
  devices: DeviceSummary[]
}>()

const simulator = useSimulator()

const options = computed(() => [
  ...props.devices.map(device => ({ value: device.id, label: device.name })),
  { value: NOT_REGISTERED, label: 'A Device that is not registered' },
])

const consequence = computed(() => callConsequence(simulator.registeredId ? simulator.device : undefined))

function choose(choice: string | null) {
  if (choice)
    simulator.choice = choice
}
</script>

<template>
  <div class="controls">
    <Field v-slot="{ control }" label="Poll as">
      <Select v-bind="control" :model-value="simulator.choice" :options="options" @update:model-value="choose" />
    </Field>
    <Field
      v-if="!simulator.registeredId"
      v-slot="{ control }"
      label="MAC address"
      hint="Calling setup with a MAC address nobody registered creates a Device. It stays until you delete it."
    >
      <span class="mac">
        <TextInput v-model="simulator.mac" v-bind="control" autocomplete="off" autocapitalize="characters" spellcheck="false" />
        <Button variant="quiet" @click="simulator.mac = madeUpMac()">
          Make one up
        </Button>
      </span>
    </Field>
    <Notice
      v-if="simulator.registeredId && simulator.detail.failure"
      :title="`Could not load ${simulator.deviceName ?? 'the Device'}.`"
      :reason="simulator.detail.failure.reason"
      action="Try again"
      @act="simulator.detail.reload"
    />
    <div class="before-call">
      <SimulatorReports />
      <SentenceLine class="consequence" :sentence="consequence" />
    </div>
    <SimulatorCalls />
  </div>
</template>

<style scoped>
@layer components {
  .controls {
    display: grid;
    gap: var(--space-5);
  }

  .controls :deep(.field) {
    width: 100%;
  }

  .mac {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
  }

  .consequence {
    max-width: var(--measure);
    padding-block: var(--space-4);
    border-bottom: var(--rule);
    text-wrap: pretty;
  }
}
</style>
