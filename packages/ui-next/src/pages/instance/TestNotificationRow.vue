<script setup lang="ts">
import { ref } from 'vue'
import { sendTestNotification } from '@/api/alerts'
import Button from '@/components/Button.vue'
import { failureReason } from '@/components/failureReason'
import ResultLine from '@/components/ResultLine.vue'
import InstanceReadRow from './InstanceReadRow.vue'

type Outcome = 'sending' | 'sent' | 'not-sent'

const outcome = ref<Outcome>()
const whyNotSent = ref<string>()

async function send() {
  outcome.value = 'sending'
  whyNotSent.value = undefined
  try {
    await sendTestNotification()
    outcome.value = 'sent'
  }
  catch (error) {
    outcome.value = 'not-sent'
    whyNotSent.value = failureReason(error)
  }
}
</script>

<template>
  <InstanceReadRow label="Test Notification">
    <Button :disabled="outcome === 'sending'" @click="send">
      Send a Test Notification
    </Button>
    <template #side>
      <ResultLine class="outcome" :class="outcome" :running="outcome === 'sending'" :icon="outcome === 'not-sent' ? 'problem' : 'check'">
        <template v-if="outcome === 'sending'" #default>
          Sending, up to 15 seconds
        </template>
        <template v-else-if="outcome === 'sent'" #default>
          Sent. Look for it in your channels.
        </template>
        <template v-else-if="outcome === 'not-sent'" #default>
          Not sent
        </template>
      </ResultLine>
    </template>
    <template #note>
      <span v-if="whyNotSent" class="why">{{ whyNotSent }}</span>
      <template v-else>
        Travels the same way as a real Notification and belongs to no Alert.
      </template>
    </template>
  </InstanceReadRow>
</template>

<style scoped>
@layer components {
  .outcome {
    text-align: left;
  }

  /* A failure is ink, never red: it is told by its weight and the problem icon. */
  .outcome.not-sent,
  .why {
    color: var(--color-ink);
  }

  .outcome.not-sent {
    font-weight: var(--weight-medium);
  }
}
</style>
