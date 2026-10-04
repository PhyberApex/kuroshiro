<script setup lang="ts">
import Notice from '@/components/Notice.vue'
import ResultLine from '@/components/ResultLine.vue'

defineProps<{
  running: boolean
  /** What is asked of TRMNL while the sync runs: "Asking TRMNL for the newest official Firmware". */
  asking: string
  /** What the sync that worked came to, as a sentence. */
  outcome?: string
  failed: boolean
  /** Why the sync failed, as the server said it. */
  reason?: string
}>()

defineEmits<{
  retry: []
}>()
</script>

<template>
  <Notice v-if="failed" class="not-synced" title="Could not sync from TRMNL." :reason="reason" action="Try again" @act="$emit('retry')" />
  <ResultLine class="sync-line" :running="running">
    <template v-if="running || outcome" #default>
      {{ running ? asking : outcome }}
    </template>
  </ResultLine>
</template>

<style scoped>
@layer components {
  .not-synced,
  .sync-line:not(:empty) {
    max-width: var(--measure);
    margin-top: var(--space-3);
  }
}
</style>
