<script setup lang="ts">
import type { IconName } from '@/components/icons'
import { ref } from 'vue'
import { sendTestNotification } from '@/api/alerts'
import Button from '@/components/Button.vue'
import { failureReason } from '@/components/failureReason'
import ResultLine from '@/components/ResultLine.vue'

import ReadRow from '@/patterns/ReadRow.vue'

type Outcome = 'sending' | 'sent' | 'not-sent'

const OUTCOME_LINES: Record<Outcome, { sentence: string, icon?: IconName }> = {
  'sending': { sentence: 'Sending, up to 15 seconds' },
  'sent': { sentence: 'Sent. Look for it in your channels.', icon: 'check' },
  'not-sent': { sentence: 'Not sent', icon: 'problem' },
}

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
  <ReadRow label="Test Notification">
    <Button :disabled="outcome === 'sending'" @click="send">
      Send a Test Notification
    </Button>
    <template #side>
      <ResultLine class="outcome" :class="outcome" :running="outcome === 'sending'" :icon="outcome && OUTCOME_LINES[outcome].icon">
        <template v-if="outcome" #default>
          {{ OUTCOME_LINES[outcome].sentence }}
        </template>
      </ResultLine>
    </template>
    <template #note>
      <span v-if="whyNotSent" class="why">{{ whyNotSent }}</span>
      <template v-else>
        Travels the same way as a real Notification and belongs to no Alert.
      </template>
    </template>
  </ReadRow>
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
