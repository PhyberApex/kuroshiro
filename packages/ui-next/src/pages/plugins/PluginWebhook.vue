<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from '@/components/Button.vue'
import CodeBlock from '@/components/CodeBlock.vue'
import CopyValue from '@/components/CopyValue.vue'
import PageSection from '@/patterns/PageSection.vue'
import ReadRow from '@/patterns/ReadRow.vue'
import { usePluginPage } from './pluginPage'
import { exampleCall, mergeStrategyRead, webhookAddress } from './pluginWebhook'
import RegenerateWebhookToken from './RegenerateWebhookToken.vue'
import WebhookPayloadRow from './WebhookPayloadRow.vue'

const { plugin } = usePluginPage()

const webhook = computed(() => plugin.value.webhook!)
const revealed = ref(false)
const merge = computed(() => mergeStrategyRead(webhook.value))
const example = computed(() => exampleCall(webhook.value, revealed.value))
</script>

<template>
  <PageSection id="data" title="Webhook" rows>
    <ReadRow label="Webhook URL">
      <span class="address">
        <CopyValue :value="webhook.url">{{ webhookAddress(webhook, revealed) }}</CopyValue>
        <Button :aria-pressed="revealed" @click="revealed = !revealed">
          {{ revealed ? 'Hide' : 'Reveal' }}
        </Button>
      </span>
      <template #note>
        POST a JSON object or array here. It becomes the Webhook Payload and {{ plugin.name }} is rendered again at once. The Webhook Token at its end is the only key, so treat the address as a secret.
      </template>
    </ReadRow>
    <ReadRow label="Merge Strategy">
      <b class="strategy">{{ merge.name }}</b>{{ ' ' }}<code class="code">{{ merge.code }}</code>
      <template v-if="merge.limit">
        · {{ merge.limit }}
      </template>
      <template #side>
        Fixed when the Plugin was created
      </template>
      <template #note>
        {{ merge.sentence }}
      </template>
    </ReadRow>
    <ReadRow class="block" label="Example">
      <CodeBlock :code="example.shown" :copy-value="example.copied" copy />
    </ReadRow>
    <WebhookPayloadRow />
    <template #under>
      A sender that should no longer reach {{ plugin.name }}?{{ ' ' }}<RegenerateWebhookToken @regenerated="revealed = true" />
    </template>
  </PageSection>
</template>

<style scoped>
@layer components {
  .address {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .strategy {
    font-weight: var(--weight-semibold);
  }

  .code {
    color: var(--color-ink-soft);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .block {
    align-items: start;
  }
}
</style>
