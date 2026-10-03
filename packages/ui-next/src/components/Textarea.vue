<script setup lang="ts">
import { commitWhenDone } from './commitWhenDone'

defineOptions({ inheritAttrs: false })

defineProps<{
  disabled?: boolean
  /** Draws the doubled ink border and sets `aria-invalid`. The message is the Field's. */
  invalid?: boolean
}>()

const emit = defineEmits<{
  /** The admin is done with the text: on blur, and only when it differs from the last one committed. Enter is a new line. */
  commit: [value: string]
}>()

defineSlots<{
  /** The place of the save state ("Saving", "Saved"), beside the textarea. */
  status?: () => unknown
}>()

const model = defineModel<string>({ default: '' })

const { hold, commit } = commitWhenDone(model, value => emit('commit', value))
</script>

<template>
  <span class="line">
    <textarea
      v-bind="$attrs"
      class="control textarea"
      :value="model"
      :disabled="disabled"
      :aria-invalid="invalid || undefined"
      @input="model = ($event.target as HTMLTextAreaElement).value"
      @focus="hold"
      @blur="commit"
    />
    <slot name="status" />
  </span>
</template>

<style scoped>
@layer components {
  .line {
    display: flex;
    align-items: flex-start;
    width: 100%;
    gap: var(--space-3);
  }

  .textarea {
    display: block;
    flex: 1;
    min-height: 6rem;
    padding-block: var(--space-2);
    line-height: 1.6;
    resize: vertical;
  }
}
</style>
