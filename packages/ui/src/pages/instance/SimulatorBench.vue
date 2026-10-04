<script setup lang="ts">
import type { DeviceSummary } from 'kuroshiro-shared'
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { firstChoice, NOT_REGISTERED, provideDeviceSimulator } from './deviceSimulator'
import SimulatorAnswer from './SimulatorAnswer.vue'
import SimulatorControls from './SimulatorControls.vue'

const props = defineProps<{
  devices: DeviceSummary[]
}>()

const route = useRoute()
const router = useRouter()
const simulator = provideDeviceSimulator(firstChoice(props.devices, route.query.device))

watch(() => simulator.choice, (choice) => {
  const { device: _named, ...query } = route.query
  void router.replace({ query: choice === NOT_REGISTERED ? query : { ...query, device: choice } })
})
</script>

<template>
  <div class="bench-frame">
    <div class="bench">
      <SimulatorAnswer />
      <SimulatorControls :devices="devices" />
    </div>
  </div>
</template>

<style scoped>
@layer components {
  .bench-frame {
    container-type: inline-size;
  }

  .bench {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: start;
    gap: var(--space-8);
  }

  /* Side by side only where each column keeps room for its plate and its fields: the page is narrower than the window. */
  @container (max-width: 36rem) {
    .bench {
      grid-template-columns: minmax(0, 1fr);
    }
  }
}
</style>
