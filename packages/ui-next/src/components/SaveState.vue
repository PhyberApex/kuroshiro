<script setup lang="ts">
import type { SaveStatus } from './useSaveAsChanged'
import Button from './Button.vue'
import Icon from './Icon.vue'
import LoadingMark from './LoadingMark.vue'

defineProps<{
  /** Where the save stands, as `useSaveAsChanged` reports it. Idle shows nothing. */
  status: SaveStatus
  /** Why the save failed, as a sentence. */
  reason?: string
}>()

defineEmits<{
  /** "Try again" was pressed. */
  retry: []
}>()
</script>

<template>
  <span class="save-state" :class="status">
    <span class="said" role="status">
      <template v-if="status === 'saving'">
        <LoadingMark decorative />Saving
      </template>
      <template v-else-if="status === 'saved'">
        <Icon name="check" class="mark" />Saved
      </template>
      <template v-else-if="status === 'failed'">
        <Icon name="problem" class="mark" /><span>{{ reason ? `Not saved. ${reason}` : 'Not saved.' }}</span>
      </template>
    </span>
    <Button v-if="status === 'failed'" variant="quiet" @click="$emit('retry')">
      Try again
    </Button>
  </span>
</template>

<style scoped>
@layer components {
  /* The status region is there before it says anything, or a screen reader does not announce it. Idle, it takes no room. */
  .save-state,
  .said {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .save-state {
    flex-wrap: wrap;
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .save-state:is(.idle, .saving, .saved) {
    white-space: nowrap;
  }

  /* An error is ink, never red: the failed state is told by its weight and the problem icon. */
  .failed {
    color: var(--color-ink);
    font-weight: var(--weight-medium);
  }

  .save-state .mark {
    width: var(--space-3);
    height: var(--space-3);
  }
}
</style>
