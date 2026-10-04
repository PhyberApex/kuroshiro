<script setup lang="ts">
import Button from '@/components/Button.vue'
import LoadingLine from '@/patterns/LoadingLine.vue'
import RelativeTime from '@/patterns/RelativeTime.vue'

/** What stands under the rows of "Data": where the data is from, and "Fetch again" for a Plugin that fetches. */
defineProps<{
  /** The Plugin's data is fetched from its Data Sources, received as a Webhook Payload, or there is none. */
  source: 'fetched' | 'received' | 'none'
  fetching: boolean
  /** When the stored Webhook Payload was received, if one was. */
  receivedAt: string | null
}>()

defineEmits<{
  fetch: []
}>()
</script>

<template>
  <div class="data-foot">
    <template v-if="source === 'fetched'">
      <LoadingLine class="said" :shown="fetching">
        Fetching the Data Sources
      </LoadingLine>
      <p v-if="!fetching" class="said">
        Fetched for this preview only. It does not move a Fetch Failure Streak.
      </p>
      <Button :disabled="fetching" @click="$emit('fetch')">
        Fetch again
      </Button>
    </template>
    <p v-else-if="source === 'none'" class="said">
      No Data Sources, so nothing is fetched.
    </p>
    <p v-else-if="receivedAt" class="said">
      The stored Webhook Payload, received <RelativeTime :at="receivedAt" />.
    </p>
    <p v-else class="said">
      Nothing received yet.
    </p>
  </div>
</template>

<style scoped>
@layer components {
  .data-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
    margin-top: var(--space-3);
  }

  .said {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    text-wrap: pretty;
  }

  /* The live region is in the page before it says anything, and takes no room until it does. */
  .said:empty {
    display: none;
  }
}
</style>
