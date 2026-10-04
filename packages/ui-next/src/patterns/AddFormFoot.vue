<script setup lang="ts">
import { RouterLink } from 'vue-router'
import Button from '@/components/Button.vue'
import ResultLine from '@/components/ResultLine.vue'
import UnsavedChanges from './UnsavedChanges.vue'

defineProps<{
  /** The name of the primary button, which submits the form the foot stands in: "Create Plugin". */
  button: string
  /** The record is being added: the button shows the loading mark. */
  running: boolean
  /** The form cannot be sent as it stands: the button is disabled. */
  disabled?: boolean
  /** Whether the form holds something that leaving would lose. False again once the record is added. */
  changed: boolean
  /** Why nothing was added, as a sentence: "Not created. That Device does not exist." */
  failure?: string
  /** Where "Cancel" leads. */
  cancelTo: string
  /** A failure comes with "Try again", for a form whose failure is a refused save that may go through as it stands. */
  retryable?: boolean
}>()

defineEmits<{
  /** "Try again" was pressed. */
  retry: []
}>()

defineSlots<{
  /** The one line under the buttons: what the admin should know before adding. */
  default: () => unknown
  /** What leaving loses: "What you entered for the new Plugin." */
  lost: () => unknown
}>()
</script>

<template>
  <div class="add-form-foot">
    <div class="buttons">
      <Button type="submit" variant="primary" :loading="running" :disabled="disabled">
        {{ button }}
      </Button>
      <Button variant="quiet" as-child>
        <RouterLink :to="cancelTo">
          Cancel
        </RouterLink>
      </Button>
    </div>
    <div class="failure-row">
      <ResultLine class="failure" icon="problem">
        <template v-if="failure" #default>
          {{ failure }}
        </template>
      </ResultLine>
      <Button v-if="failure && retryable" variant="quiet" :disabled="running" @click="$emit('retry')">
        Try again
      </Button>
    </div>
    <p class="know">
      <slot />
    </p>
  </div>
  <UnsavedChanges :when="changed">
    <template #lost>
      <slot name="lost" />
    </template>
  </UnsavedChanges>
</template>

<style scoped>
@layer components {
  .add-form-foot {
    margin-top: var(--space-2);
    padding-top: var(--space-4);
    border-top: var(--rule);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
  }

  .failure-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
  }

  .failure-row:has(.failure:not(:empty)),
  .know {
    margin-top: var(--space-3);
  }

  .know {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
