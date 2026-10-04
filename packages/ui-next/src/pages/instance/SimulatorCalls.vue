<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from '@/components/Button.vue'
import Confirmation from '@/components/Confirmation.vue'
import { useSimulator } from './deviceSimulator'
import { pendingLost, pendingTaken } from './simulatorWording'

const simulator = useSimulator()

const confirming = ref(false)

const name = computed(() => simulator.listed?.name)
const pollLabel = computed(() => simulator.registered && name.value ? `Poll as ${name.value}` : 'Poll')
const takes = computed(() => simulator.device ? pendingTaken(simulator.device) : [])

function poll() {
  if (takes.value.length > 0)
    confirming.value = true
  else
    void simulator.poll()
}
</script>

<template>
  <div class="calls">
    <Button variant="primary" :disabled="!simulator.canPoll || simulator.calling === 'setup'" :loading="simulator.calling === 'poll'" @click="poll">
      {{ pollLabel }}
    </Button>
    <Button :disabled="(simulator.registered && !simulator.device) || simulator.calling === 'poll'" :loading="simulator.calling === 'setup'" @click="simulator.setup">
      Call setup
    </Button>
  </div>
  <Confirmation
    v-if="simulator.device"
    v-model:open="confirming"
    :title="`${pollLabel}?`"
    :confirm-label="pollLabel"
    :safe-label="takes.length > 1 ? 'Keep them pending' : 'Keep it pending'"
    :action="simulator.poll"
  >
    <template #lost>
      {{ pendingLost(simulator.device) }}
    </template>
    <template #stays>
      {{ name }}, its Screens and its Settings.
    </template>
  </Confirmation>
</template>

<style scoped>
@layer components {
  .calls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
}
</style>
