<script setup lang="ts">
import { computed, ref } from 'vue'
import { clearWebhookPayload } from '@/api/plugins'
import Button from '@/components/Button.vue'
import CodeBlock from '@/components/CodeBlock.vue'
import Confirmation from '@/components/Confirmation.vue'
import ReadRow from '@/patterns/ReadRow.vue'
import RelativeTime from '@/patterns/RelativeTime.vue'
import { usePluginPage } from './pluginPage'
import { clearPayloadWording, payloadExampleKey, payloadText } from './pluginWebhook'

const PAYLOAD_LINES_SHOWN = 30

const { plugin, reload } = usePluginPage()

const webhook = computed(() => plugin.value.webhook!)
const received = computed(() => webhook.value.payload !== null)
const exampleKey = computed(() => payloadExampleKey(webhook.value.payload))
const exampleRead = computed(() => `{{ ${exampleKey.value} }}`)
const wording = computed(() => clearPayloadWording(plugin.value.name))
const asking = ref(false)

const clear = () => clearWebhookPayload(plugin.value.id)
</script>

<template>
  <ReadRow class="block" label="Webhook Payload">
    <div v-if="received" class="payload">
      <p class="received">
        <template v-if="webhook.payloadReceivedAt">
          Received <RelativeTime :at="webhook.payloadReceivedAt" />.
        </template>
        <template v-if="exampleKey">
          The template reads its keys directly, for example <code class="code">{{ exampleRead }}</code>.
        </template>
      </p>
      <CodeBlock :code="payloadText(webhook.payload)" :fold-after="PAYLOAD_LINES_SHOWN" />
      <div>
        <Button @click="asking = true">
          Clear Webhook Payload
        </Button>
      </div>
    </div>
    <p v-else class="nothing">
      Nothing received yet. Until the first POST arrives the template renders without data.
    </p>
  </ReadRow>
  <Confirmation v-model:open="asking" :title="wording.title" confirm-label="Clear Webhook Payload" :action="clear" @confirmed="reload">
    <template #lost>
      {{ wording.lost }}
    </template>
    <template #stays>
      {{ wording.stays }}
    </template>
  </Confirmation>
</template>

<style scoped>
@layer components {
  .block {
    align-items: start;
  }

  .payload {
    display: grid;
    gap: var(--space-3);
  }

  .received,
  .nothing {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .code {
    font-family: var(--font-mono);
  }
}
</style>
